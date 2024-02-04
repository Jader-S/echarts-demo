<template>
  <div class="board" ref="board">
    <div id="view" ref="view"></div>
    <div
      v-if="dataInfoCopy.title"
      :class="['moving', dataInfoCopy.isOwner && 'is-owner', fromTooltip && 'from-tooltip']"
      :style="{left: dataMovingX+'px', top: dataMovingY+'px', height: dataMovingHeight+'px', width: dataMovingWidth+'px',display: dataMovingShow ? 'block': 'none' }"
      >
      <div class="title">
        {{ dataInfoCopy.title }}
      </div>
      <template v-if="!fromTooltip">
        <div class="content">
          <div class="label">主持人</div>
          <div class="item">
            {{ dataInfoCopy.info1 }}
          </div>
        </div>
        <div class="content">
          <div class="label">会议室</div>
          <div class="item">
            {{ dataInfoCopy.info2 }}
          </div>
        </div>
        <div class="content">
          <div class="label">时   间</div>
          <div class="item">
            {{ dataInfoCopy.during }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
<script>
import * as echarts from 'echarts';
import moment from 'moment';
import { getBoardData } from '@/mock/board'

export default {
  name: 'echarts_board',
  data() {
    return {
      charts: null,
      boardData: [],
      eChartsData: [],
      startDate: moment().startOf('week'),
      endDate: moment().endOf('week'),
      dayWidth: 0,

      // 可配置参数
      windowTimeSpan: 8, // 窗口内时间跨度  可选5,6,7,8
      windowDaySpan: 5, // 窗口内日期跨度 可选1 ~ 7  默认5
      dayStartValue: 0, // 窗口开始日期 默认0
      conferenceData: [],

      // 拖拽相关
      dataInfoCopy: {},
      dataMovingX: 0,
      dataMovingY: 0,
      dataMovingWidth: 0,
      dataMovingHeight: 0,
      diffX: 0,
      diffY: 0,
      dataMovingShow: false,
      fromTooltip: false,
      activeSubmit: null,
    }
  },
  computed: {
    view() {
      return this.$refs.view;
    },
    dayList() {
      const { startDate, endDate } = this;
      const daySpan = moment(endDate).diff(startDate, 'days');
      const dayList = [];
      for (let i = 0; i <= daySpan; i += 1) {
        const day = moment(startDate).add(i, 'days');
        dayList.push(day.format('YYYY-MM-DD'));
      }
      return dayList;
    },
    timeStartValue() {
      const startTime = '09:00';
      let result = `${moment().format('YYYY-MM-DD')} ${startTime}`;
      if (moment(result).isBefore(moment().hour(9))) {
        result = `${moment().format('YYYY-MM-DD')} 09:00`;
      }
      return moment(result).subtract(10, 'minutes').valueOf();
    },
    timeEndValue() {
      return this.timeStartValue + (60 * 60 * this.windowTimeSpan * 1000); // 窗口时间结束值
    },
    dayEndValue() {
      return this.dayStartValue + this.windowDaySpan; // 天结束值
    },
    timeYAaisMin() {
      const startTime = '09:00';
      const result = `${moment().format('YYYY-MM-DD')} ${startTime}`;
      return moment(result).subtract(10, 'minutes').format('YYYY-MM-DD HH:mm');
    },
    timeYAaisMax() {
      const endTime = '24:00';
      return `${moment().format('YYYY-MM-DD')} ${endTime}`;
    },
  },
  mounted() {
    this.initData();
  },
  methods: {
    initData() {
      getBoardData.then(res=>{
        this.$set(this, 'boardData', res)
        this.$set(this, 'eChartsData', this.formatDataForECharts(res))
        this.initView();
      })
    },
    initView() {
      let view = this.$refs.view;
      this.charts = echarts.init(view);
      this.updateView();
      window.closeTooltip = this.closeTooltip;
      // 窗口resize时自动更新echarts
      this.$nextTick(() => {
        const resizeOb = new ResizeObserver(this.updateView);
        resizeOb.observe(this.$refs.board);
        this.bindDrag();
      });
    },
    updateView(){
      const { dayList, windowDaySpan } = this;
      const dayListLength = dayList.length;
      const length = dayListLength > windowDaySpan + 1 ? windowDaySpan + 1 : dayListLength;
      this.dayWidth = (this.view.clientWidth - 80) / length;
      this.charts.setOption(this.markOption());
      this.charts.resize();
    },
    /**
     * @description: 初始化时间列表
     * @return {Null}
     */
    initDayList() {
      const { startDate, endDate } = this;
      const daySpan = moment(endDate).diff(startDate, 'days');
      const dayList = [];
      for (let i = 0; i <= daySpan; i += 1) {
        const day = moment(startDate).add(i, 'days');
        dayList.push(day.format('YYYY-MM-DD'));
      }
      this.$set(this, 'dayList', dayList);
    },

    /**
     * @description: 格式化数据 构建可供eCharts使用的数据
     * @return {*}
     */
    formatDataForECharts(data) {
      const eChartsData = [...data];
      const baseDate = moment().format('YYYY-MM-DD');
      const map = new Map();
      eChartsData.forEach(item => {
        const { date, startTime, endTime, title, info1, info2, id, isMoving } = item;
        const contentInfo = [
          this.getDayIndex(date),
          moment(`${baseDate} ${startTime}`).format('YYYY-MM-DD HH:mm'),
          moment(`${baseDate} ${endTime}`).format('YYYY-MM-DD HH:mm'),
          JSON.stringify([{
            id,
            title,
            info1,
            info2,
            date,
            startTime,
            endTime,
            during: `${startTime}-${endTime}`,
            isMoving,
          }])
        ]
        if (map.has(date)) {
          let dataInOneDay = map.get(date);
          // TODO 这边写复杂了，后续函数应该可以优化
          dataInOneDay = this.buildDataByTime(dataInOneDay, contentInfo);
          map.set(date, dataInOneDay)
        } else {
          map.set(date, [contentInfo]);
        }
      })
      const mapArray = Array.from(map.values());
      let dataForECharts = [];
      for(let i = 0; i < mapArray.length; i += 1){
        const dataList = mapArray[i];
        dataForECharts.push(...dataList)
      }
      dataForECharts = this.sortData(dataForECharts);
      dataForECharts.forEach((item, index) => {
        item[4] = index;
      });
      return dataForECharts
    },
    /**
     * @description: 将开始时间相同的数据添加到一个数据中
     * @param {Array} dataInOneDay 某天的数据列表
     * @param {Array} contentInfo 需要添加到列表的数据
     * @return {Null}
     */
    buildDataByTime(dataInOneDay, contentInfo) {
      let map = new Map();
      dataInOneDay.forEach((contentInfoItem) => {
        map = this.makeMap(map, contentInfoItem);
      });
      map = this.makeMap(map, contentInfo);
      return Array.from(map.values());
    },
    /**
     * @description: 根据开始时间创建map
     * @param {Map} map
     * @param {Array} contentInfo 需要添加到列表的数据
     * @return {*}
     */
    makeMap(map, contentInfo) {
      const startTime = contentInfo[1];
      if (map.has(startTime)) {
        const dataListOnOneTime = map.get(startTime);
        const list = JSON.parse(dataListOnOneTime[3]);
        const dataOnOneTime = JSON.parse(contentInfo[3])[0];
        // 如果list中没有此id
        if (!list.find(item => item.id === dataOnOneTime.id)) {
          list.push(dataOnOneTime);
        }
        dataListOnOneTime[3] = JSON.stringify(list);
        map.set(startTime, dataListOnOneTime);
      } else {
        map.set(startTime, contentInfo);
      }
      return map;
    },
    /**
     * @description: 根据数据实际日期时间排序（eCharts渲染时，让时间靠后的数据覆盖前面的）
     * @param {Array} data 需要处理的数据
     * @return {*}
     */
    sortData(data) {
      return data.sort((a, b) => {
        const dataA = JSON.parse(a[3])[0];
        const dataB = JSON.parse(b[3])[0];
        const { date: date1, startTime: start1, isMoving: isMoving1, } = dataA;
        const { date: date2, startTime: start2, isMoving: isMoving2,  } = dataB;
        // 若数据为当前拖动中，则排到最后
        if (isMoving1 || isMoving2) return isMoving1 - isMoving2;
        // 若正常数据，则根据当天时间排序，后面的数据覆盖前面的
        return moment(`${date1} ${start1}`).isAfter(moment(`${date2} ${start2}`)) ? 1 : -1;
      });
    },
    markOption() {
      const { dayWidth, getWeekName } = this;
      return {
        grid: {
          top: 20,
          left: 20,
          right: 20,
          bottom: 20,
          containLabel: true,
        },
        tooltip: {
          formatter: this.tooltipFormatter,
          triggerOn: 'click',
          enterable: true,
          extraCssText: 'width: 200px;padding: 20px;border:none;max-height:390px;overflow-y: auto;box-shadow: 0px 0px 12px 0px #E2E3EE;border-radius:8px;',
        },
        dataZoom: [
          {
            yAxisIndex: 0,
            realtime: true,
            type: 'slider',
            startValue: this.timeStartValue,
            endValue: this.timeEndValue,
            filterMode: 'weakFilter',
            show: true,
            showDetail: false,
            zoomLock: true,
            width: 10,
            right: 10,
            bottom: 30,
            brushSelect: false,
            handleIcon:
              'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
            handleSize: '80%',
            fillerColor: '#E2E7EF',
            handleStyle: {
              color: '#ABB7C9',
            },
            borderColor: 'rgba(227, 235, 243, 0.3)',
            backgroundColor: 'rgba(227, 235, 243, 0.3)',
          },
          {
            type: 'inside',
            yAxisIndex: 0,
            realtime: true,
            start: 0,
            end: 100,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
            moveOnMouseMove: false,
            maxSpan: 60,
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'weakFilter',
            height: 10,
            bottom: 10,
            startValue: this.dayStartValue,
            endValue: this.dayEndValue,
            handleIcon:
              'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
            handleSize: '80%',
            fillerColor: '#E2E7EF',
            handleStyle: {
              color: '#ABB7C9',
            },
            borderColor: 'rgba(227, 235, 243, 0.3)',
            backgroundColor: 'rgba(227, 235, 243, 0.3)',
            minValueSpan: 5,
            showDetail: false,
            brushSelect: false,
          },
          {
            type: 'inside',
            xAxisIndex: 0,
            realtime: true,
            start: 0,
            end: 0,
            filterMode: 'weakFilter',
            zoomOnMouseWheel: false,
            moveOnMouseWheel: false,
            moveOnMouseMove: false,
            maxSpan: 60,
          },
        ],
        xAxis: {
          type: 'category',
          position: 'top',
          margin: 0,
          axisPointer: {
            show: false,
          },
          axisTick: {
            show: true,
            length: 60,
            lineStyle: {
              color: ['#EBEDF0'],
            },
          },
          axisLine: {
            lineStyle: {
              color: ['#EBEDF0'],
              width: 2,
            },
          },
          splitLine: {
            show: true,
            interval: 0,
            lineStyle: {
              color: ['#EBEDF0'],
            },
          },
          lineStyle: {
            shadowColor: '#FF0000',
            shadowBlur: 10,
            shadowOffsetX: 2,
            shadowOffsetY: 4,
          },
          axisLabel: {
            margin: 8,
            interval: 0,
            color: '#202340',
            align: 'left',
            padding: [0, 0, 0, -(dayWidth / 2) + 10],
            formatter(value) {
              return `{week|${getWeekName(value)}}\n{day|${moment(value).format('DD')}}`;
            },
            rich: {
              week: {
                fontSize: 12,
                lineHeight: 18,
                align: 'left',
                verticalAlign: 'middle',
              },
              day: {
                fontSize: 24,
                lineHeight: 29,
                align: 'left',
                fontFamily: 'DIN-Medium',
                fontWeight: '400',
              },
            },
            textStyle: {
              color: (value) => {
                // 当前日颜色改为#6373FF
                if (moment(value).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD')) {
                  return '#6373FF';
                }
                return '#202340';
              },
            },
          },
          data: this.dayList,
        },
        yAxis: {
          type: 'time',
          position: 'left',
          offset: 20,
          inverse: true,
          min: this.timeYAaisMin,
          max: this.timeYAaisMax,
          axisPointer: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLine: {
            show: false,
          },
          splitLine: {
            show: true,
            interval: 0,
            lineStyle: {
              color: ['#EBEDF0'],
            },
          },
          axisLabel: {
            color: '#8E92B3',
            align: 'center',
            verticalAlign: 'middle',
            showMaxLabel: true,
            formatter: value => moment(value).format('HH:mm'), // 格式化成小时/分钟
          },
        },
        series: [
          {
            type: 'custom',
            key: 'custom',
            encode: {
              x: 0,
              y: [1, 2],
            },
            renderItem: this.renderItem,
            data: this.eChartsData,
            animation: false,
            universalTransition: {
              enabled: true,
              divideShape: 'split',
            },
          },
        ],
      }
    },
    /**
     * @description: 自定义渲染逻辑
     * @param {Object} params 元素参数
     * @param {Object} api 坐标系接口
     * @return {Null}
     */
    renderItem(params, api) {
      const dayIndex = api.value(0);
      const data = api.value(3);
      if (!data) return {};
      // 获取数据信息
      const dataList = JSON.parse(data);
      const startTime = api.value(1);
      const startTimeSeat = api.coord([dayIndex, startTime]);
      const endTime = api.value(2);
      const endTimeSeat = api.coord([dayIndex, endTime]);
      const index = api.value(4);

      // 获取单个数据卡片宽高
      const barHeight = endTimeSeat[1] - startTimeSeat[1];
      const barWidth = api.size([1, 0])[0];
      const defaultBarHeight = api.coord([dayIndex, moment(startTime).add(1, 'hours')])[1] - startTimeSeat[1];

      const mainContent = this.createMainContent({
        startTimeSeat,
        barWidth,
        barHeight,
        params,
        api,
        dataList,
        defaultBarHeight,
        index,
      });
      if (!mainContent) return {};
      const contentResult = {
        type: 'group',
        name: 'main',
        children: [
          ...mainContent,
        ],
      };
      return contentResult;
    },
    createMainContent({
      startTimeSeat,
      barWidth,
      barHeight,
      params,
      api,
      dataList,
      defaultBarHeight,
      index,
    }) {
      const data = dataList[0];
      const {
        title,
        isMoving,
        isOverlap,
      } = data;
      let { id } = data;
      if(dataList.length > 1) {
        // 若当前时间段有多个数据，则将id置空
        id = '';
      }
      let backgroundRectList = [this.createBackgroundRect({
        params,
        startTimeSeat,
        barWidth,
        barHeight,
        id,
        isMoving,
        index,
      })];
      
      // 计算主题宽度
      const titleWidth = this.getTextWidth(title, 12);
      // 计算单个文字宽度
      const perWidth = titleWidth / this.getLength(title);
      // 计算剪切长度
      const cutLength = Math.floor((barWidth - 36) / perWidth);
      // 计算主题高度
      const perHeight = defaultBarHeight / 3;
      // 计算主题间距
      const distance = (perHeight - 12) / 2;

      let titleContentList = [];
      let infoContent = null;
      if (dataList.length > 1) {
        // 若多个数据处于同一时间，则分层级渲染多个背景
        let fill = '#FFFFFF';
        const elseArr = dataList.slice(1);
        titleContentList = this.createTitleContentList({
          params,
          startTimeSeat,
          barWidth,
          perHeight,
          distance,
          dataList,
          cutLength,
          fill,
          index,
        });
        backgroundRectList = backgroundRectList.concat(this.createBackgroundRectList({
          params,
          api,
          elseArr,
          startTimeSeat,
          barWidth,
            index,
        }));
      } else {
        // 若当前时间只有一个会议，则展示数据详细信息
        infoContent = this.createDataContentList({
          params,
          startTimeSeat,
          barWidth,
          perHeight,
          distance,
          data,
          cutLength,
          barHeight,
          defaultBarHeight,
          isOverlap,
          isMoving,
          index,
        });
      }
      // 构建主体元素
      const mainContent = [
        // 背景
        ...backgroundRectList,
        // 主题
        ...titleContentList,
      ];


      if (infoContent) {
        mainContent.push(infoContent);
      }
      return mainContent;
    },
    /**
     * @description: 创建背景块列表
     * @param {Object} params 元素参数
     * @param {Object} api 坐标系接口
     * @param {String} elseArr 其他数据列表
     * @param {Object} startTimeSeat 开始位置坐标
     * @param {Number} barWidth 元素宽度
     * @return {Array} 背景元素列表
     */
    createBackgroundRectList({
      params,
      api,
      elseArr,
      startTimeSeat,
      barWidth,
      index,
    }) {
      const length = elseArr.length >= 3 ? 3 : elseArr.length;
      const backgroundRectList = [];
      for (let i = 0; i < length; i += 1) {
        const {
          date,
          endTime,
          isOverlap,
        } = elseArr[i];
        const baseDate = moment().format('YYYY-MM-DD');
        const endTimeStamp = moment(`${baseDate} ${endTime}`).valueOf();
        const dayIndex = this.getDayIndex(date);
        const endTimeSeat = api.coord([dayIndex, endTimeStamp]);
        const barHeight = endTimeSeat[1] - startTimeSeat[1];
        // 背景
        const backgroundRect = this.createBackgroundRect({
          params,
          startTimeSeat,
          barWidth,
          barHeight,
          isOverlap,
          index,
        });
        backgroundRectList.push(backgroundRect);
      }
      return backgroundRectList;
    },
    /**
     * @description: 创建背景元素
     * @param {Object} params 元素参数
     * @param {Object} startTimeSeat 开始位置坐标
     * @param {Number} barWidth 元素宽度
     * @param {Number} barHeight 元素高度
     * @param {Boolean} isOverlap 是否重叠
     * @param {Boolean} isMoving 是否在拖拽
     * @param {Number} index 索引
     * @param {String} id 数据id
     * @return {*}
     */
    createBackgroundRect({
      params,
      startTimeSeat,
      barWidth,
      barHeight,
      isOverlap,
      isMoving,
      index,
      id,
    }) {
      const x = startTimeSeat[0] - barWidth / 2;

      // 创建卡片主体矩形元素
      const backgroundRectShape = this.clipRectByRect(params, {
        x: x + 2,
        y: startTimeSeat[1] + 2,
        width: barWidth - 4,
        height: barHeight - 4,
      });
      // 设置圆角
      if(backgroundRectShape) backgroundRectShape.r = [6, 6, 6, 6];
      let z2 = 9 + index;
      if (isOverlap) {
        z2 += 1;
      }
      let strokeFill = '#FFFFFF';
      let rectFill = '#6373FF';
      if(isMoving) rectFill = '#6373FF80';
      // 背景
      const backgroundRect = {
        type: 'rect',
        ignore: !backgroundRectShape,
        shape: backgroundRectShape,
        z2,
        emphasisDisabled: true,
        emphasis: {
          style: {
            fill: rectFill,
            stroke: strokeFill,
          },
          z2: z2 + this.eChartsData.length + 5,
        },
        style: {
          fill: rectFill,
          stroke: strokeFill,
          overflow: 'hidden',
        },
        // 将数据id保存至背景卡片
        extra: {
          id,
        },
      };
      return backgroundRect;
    },
    /**
     * @description: 创建数据信息列表元素
     * @param {Object} params renderItem 参数列表
     * @param {Array} dataList 数据列表
     * @param {Object} startTimeSeat 开始时间坐标
     * @param {Number} barWidth 元素宽度
     * @param {Number} perHeight 单个元素高度
     * @param {Number} distance 主题间距
     * @param {Number} cutLength 剪切长度
     * @param {String} fill 填充颜色
     * @param {Number} index 索引
     * @return {Array} 数据信息列表
     */
    createTitleContentList({
      params,
      startTimeSeat,
      barWidth,
      perHeight,
      distance,
      dataList,
      cutLength,
      fill,
      index,
    }) {
      const dataObj = dataList[0];
      const elseArr = dataList.slice(1);
      const length = elseArr.length > 2 ? 2 : elseArr.length;
      const titleReactShape = this.clipRectByRect(params, {
        x: startTimeSeat[0] - barWidth / 2 + 5,
        y: startTimeSeat[1] + distance,
        width: barWidth,
        height: perHeight,
      });
      if (!titleReactShape) return [];
      const titleContentList = [];
      const titleContent = this.createTitleContent({
        shape: titleReactShape, data: dataObj, cutLength, fill,index,
      });
      if (titleContent) {
        titleContentList.push(titleContent);
      }
      for (let i = 0; i < length; i += 1) {
        const elseTitleReactShape = this.clipRectByRect(params, {
          x: startTimeSeat[0] - barWidth / 2 + 5,
          y: startTimeSeat[1] + (i + 1) * perHeight + distance,
          width: barWidth,
          height: perHeight,
        });
        titleContentList.push(this.createLineContent(elseTitleReactShape, distance, index));
        if (elseArr.length > 2 && i === 1) {
          titleContentList.push(this.createTitleContent({
            shape: elseTitleReactShape, data: { title: `还有${elseArr.length - 1}项...`, type: 'remind' }, cutLength, fill, index,
          }));
        } else {
          titleContentList.push(this.createTitleContent({
            shape: elseTitleReactShape, data: elseArr[i], cutLength, fill, index,
          }));
        }
      }
      return titleContentList;
    },
    /**
     * @description: 创建主题元素
     * @param {Object} shape 主题矩形
     * @param {Object} data 数据信息
     * @param {Number} cutLength 剪切长度
     * @param {String} fill 填充颜色
     * @param {Boolean} isOverlap 是否重叠
     * @return {Object} 主题元素
     */
    createTitleContent({
      shape, data, cutLength, fill, isOverlap, index,
    }) {
      if (!shape) return;
      const {
        id,
      } = data;
      let { title } = data;
      let x = shape.x + 18;
      let width = shape.width - 36;
      if (isOverlap) {
        x += 5;
        width -= 5;
      }
      let z2 = 10 + index;
      // eslint-disable-next-line consistent-return
      return {
        type: 'group',
        children: [
          {
            type: 'text',
            left: 'center',
            top: 'center',
            x,
            y: shape.y,
            z2,
            width,
            style: {
              fill,
              text: this.realSubstring(`${title}`, cutLength),
              overflow: 'hidden',
              fontSize: 12,
            },
            emphasis: {
              style: {
                fill,
              },
              z2: z2 + this.eChartsData.length + 5,
            },
            textConfig: {
              position: 'insideTopLeft',
              inside: true,
              style: {
                overflow: 'hidden',
              },
            },
            extra: {
              id,
            },
          }
        ],
      };
    },
    /**
     * @description: 创建数据信息列表元素
     * @param {Object} params renderItem 参数列表
     * @param {Object} startTimeSeat 开始时间坐标
     * @param {Number} barWidth 元素宽度
     * @param {Number} barHeight 元素高度
     * @param {Number} perHeight 单个元素高度
     * @param {Number} distance 间距
     * @param {Object} data 数据信息
     * @param {Number} cutLength 剪切长度
     * @param {Number} barHeight 元素高度
     * @param {Number} defaultBarHeight 默认元素高度
     * @param {Boolean} isOverlap 是否重叠
     * @param {Boolean} isMoving 是否移动中
     * @return {Array} 数据信息列表
     */
    createDataContentList({
      params,
      startTimeSeat,
      barWidth,
      perHeight,
      distance,
      data,
      cutLength,
      barHeight,
      defaultBarHeight,
      isOverlap,
      isMoving,
      index,
    }) {
      let fill = '#000000';
        if (isMoving) {
          fill = '#C0C7FF';
        } else {
          fill = '#FFFFFF';
        }
      const titleShape = this.clipRectByRect(params, {
        x: startTimeSeat[0] - barWidth / 2 + 5,
        y: startTimeSeat[1] + distance,
        width: barWidth,
        height: perHeight,
      });
      const titleContent = this.createTitleContent({
        shape: titleShape, data, cutLength, fill, isOverlap, index,
      });
      const dataContent = {
        type: 'group',
        children: [],
      };
      if (titleContent) {
        dataContent.children.push(titleContent);
      }
      const { title, id } = data;
      if (barHeight >= defaultBarHeight) {
        const propertyList = [
          'info1',
          'info2',
          'during'];
        const propertyPerHeight = defaultBarHeight / 3 * 2 / 3;
        const propertyWidth = this.getTextWidth(title, 10);
        const propertyPerWidth = propertyWidth / this.getLength(title);
        const propertyCutLength = Math.floor((barWidth - 30) / propertyPerWidth);
        for (let i = 0; i < 3; i += 1) {
          const key = propertyList[i];
          const dataShape = this.clipRectByRect(params, {
            x: startTimeSeat[0] - barWidth / 2 + 5,
            y: startTimeSeat[1] + (i + 1) * propertyPerHeight + distance,
            width: barWidth,
            height: propertyPerHeight,
          });
          if (dataShape) {
            dataContent.children.push(this.createDataContent({shape: dataShape, key, value:data[key], cutLength: propertyCutLength, id, index}));
          }
        }
      }
      return dataContent;
    },
    /**
     * @description: 创建数据信息元素
     * @param {Object} shape 矩形
     * @param {String} key 属性名称
     * @param {String} value 属性值
     * @param {Number} cutLength 剪切长度
     * @param {String} id 数据id
     * @param {Number} index 索引
     * @return {Object} 数据信息元素
     */
    createDataContent({shape, key, value, cutLength, id, index}) {
      const keyMap = {
        info1: '主持人',
        info2: '数据室',
        during: '时   间',
      };
      const fill = '#C0C7FF';
      let z2 = 10 + index;
      return {
        type: 'group',
        children: [
          {
            type: 'text',
            left: 'center',
            top: 'center',
            x: shape.x + 18,
            y: shape.y,
            z2,
            width: shape.width,
            height: shape.height,
            style: {
              fill,
              text: this.realSubstring(`${keyMap[key]} ${value}`, cutLength),
              overflow: 'hidden',
              fontSize: 10,
            },
            emphasis: {
              style: {
                fill,
              },
              z2: z2 + this.eChartsData.length + 5,
            },
            textConfig: {
              position: 'insideTopLeft',
              inside: true,
              style: {
                overflow: 'hidden',
              },
            },
            extra: {
              id,
            },
          },
        ],
      };
    },
    /**
     * @description: 创建线元素
     * @param {Object} shape 矩形
     * @param {Number} translateY 间距
     * @param {Number} index 索引
     * @return {Null}
     */
    createLineContent(shape, translateY, index) {
      const z2 = 10 + index;
      return {
        type: 'line',
        z2,
        shape: {
          x1: shape.x + 15,
          y1: shape.y - translateY,
          x2: shape.x + shape.width - 15,
          y2: shape.y - translateY,
        },
        style: {
          stroke: '#C3C5D9',
          lineWidth: 0.5,
          lineDash: [4, 4],
        },
        emphasis: {
          z2: z2 + this.eChartsData.length + 5,
        },
      };
    },

    // #region 弹窗相关
    /**
     * @description: 渲染 tooltip 内容
     * @param {*} params
     * @return {Null}
     */
    tooltipFormatter(params) {
      const { data } = params;
      const dataList = JSON.parse(data[3]);
      const startTime = data[1];
      if (dataList.length <= 3) {
        return '';
      }
      let result = `<div>
        <div style="display:flex;flex-direction: row;align-items: flex-end;margin-bottom: 10px;">
          <div style="font-size: 24px;
                      font-family: DINAlternate, DINAlternate;
                      font-weight: bold;
                      color: #202340;
                      margin-right:8px;">${moment(startTime).format('DD')}</div>
          <div style="height: 17px;
                      font-size: 12px;
                      font-family: PingFangSC, PingFang SC;
                      font-weight: 400;
                      color: #565B85;">${moment(startTime).format('HH:mm')}</div>
        </div>`;
      dataList.forEach((item) => {
        const {
          title,
          id,
        } = item;
        const $item = JSON.stringify(item).replace(/"/g, "'");
        result += `<div style="font-size: 14px;
                      background-color: #6373FF;
                      border-radius: 4px;
                      color: #fff;
                      padding-left: 8px;
                      margin-bottom: 4px;
                      padding-left: 8px;
                      height: 28px;
                      line-height: 28px;
                      width: 100%;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      display: block;
                      cursor: pointer;
                      border:none;"
                      onMousedown="tooltipMouseDown(${$item},event)"
                      oncontextmenu="conferenceContextmenu({id:'${id}',position:{
                        x:event.layerX,
                        y:event.layerY,
                      }})"><span style="color: '#fff';vertical-align: middle;margin-left: 2px;">${title}</span>
          </div>`;
      });
      result += '</div>';
      return result;
    },
    /**
     * @description: 手动关闭tooltip
     * @return {Null}
     */
    closeTooltip() {
      const { view } = this.$refs;
      view.lastElementChild.style.display = 'none';
    },
    // #endregion

    /**
     * @description: 绑定拖拽事件
     * @return {Null}
     */
    bindDrag() {
      this.charts.on('mousedown', (params) => {
        const {event } = params
        // 获取数据id
        let id = '';
        if(event.target.extra){
          id = event.target.extra.id
        } else {
          id = event.target.parent.extra.id;
        }
        if (id) {
        // 若存在数据ID，则触发数据点击事件
          this.mouseDown(params, id);
        }
      });
      window.tooltipMouseDown = this.tooltipMouseDown;
    },
    /**
     * @description: 设置拖拽位置信息
     * @param {Number} diffX 鼠标位置与点击contentX坐标偏移量
     * @param {Number} diffY 鼠标位置与点击contentY坐标偏移量
     * @param {Number} clientX 拖拽元素x坐标
     * @param {Number} clientY 拖拽元素x坐标
     * @param {Number} width content宽度
     * @param {Number} height content高度
     * @return {Null}
     */
    setPosition({
      diffX, diffY, clientX, clientY, width, height,
    }) {
      this.$set(this, 'diffX', diffX);
      this.$set(this, 'diffY', diffY);
      this.$set(this, 'dataMovingX', clientX - diffX);
      this.$set(this, 'dataMovingY', clientY - diffY);
      this.$set(this, 'dataMovingWidth', width);
      this.$set(this, 'dataMovingHeight', height);
    },
    /**
     * @description: 点击tooltip内会议触发事件
     * @param {Object} dataInfo 会议信息
     * @param {Object} event 事件对象
     * @return {Null}
     */
    tooltipMouseDown(dataInfo, event) {
      dataInfo.isMoving = true;
      this.$set(this, 'fromTooltip', true);
      const { clientX, clientY } = event;
      let { target } = event;
      if (target.tagName === 'SPAN') {
        target = target.parentNode;
      }
      const domRect = target.getBoundingClientRect();
      const {
        x, y, height, width,
      } = domRect;
      const diffX = clientX - x;
      const diffY = clientY - y;
      this.setPosition({
        diffX, diffY, clientX, clientY, width, height,
      });
      const dataInfoCopy = JSON.parse(JSON.stringify(dataInfo));
      this.$set(this, 'dataInfoCopy', dataInfoCopy);
      window.addEventListener('mousemove', this.mouseMove);
      window.addEventListener('mouseup', this.mouseUp);
      this.closeTooltip();
    },
    /**
     * @description: mousedown事件 绑定拖拽
     * @param {Object} params 事件参数
     * @param {String} id 会议id
     * @return {Null}
     */
    mouseDown(params, id) {
      const zr = this.charts.getZr();
      const { value } = params;
      const dataListInOneTime = JSON.parse(value[3]);
      const dataInfo = dataListInOneTime.find(item => item.id === id);
      dataInfo.isMoving = true;
      this.$set(this, 'fromTooltip', false);
      const target = params.event.target;
      const backgroundRect = this.getBackgroundRect(target, id);
      const { offsetX, offsetY } = params.event;
      const {
        x, y, height, width,
      } = backgroundRect.shape;
      const diffX = offsetX - x;
      const diffY = offsetY - y;
      this.setPosition({
        diffX, diffY, clientX: offsetX, clientY: offsetY, width, height,
      });
      const dataInfoCopy = JSON.parse(JSON.stringify(dataInfo));
      this.$set(this, 'dataInfoCopy', dataInfoCopy);
      zr.on('mousemove', (params) => {
        this.mouseMove(params, true);
      });
      zr.on('mouseup', (params) => {
        this.mouseUp(params);
        this.$set(this, 'dataInfoCopy', { });
      });
    },
    /**
     * @description: mouseMove事件，拖拽元素移动
     * @param {Object} params 事件参数
     * @param {Object} dataInfo 会议信息
     * @return {Null}
     */
    mouseMove(params) {
      const { dataInfoCopy,windowDaySpan } = this;
      const {
        charts, diffX, diffY,
      } = this;
      const {
        offsetX, offsetY,
      } = params;
      let dataMovingX = offsetX - diffX;
      let dataMovingY = offsetY - diffY;
      const { startTime, endTime, date } = dataInfoCopy;
      const timeDiff = moment(`${date} ${endTime}:00`).diff(moment(`${date} ${startTime}:00`), 'minutes');
      this.$set(this, 'dataMovingX', dataMovingX);
      this.$set(this, 'dataMovingY', dataMovingY);
      this.$set(this, 'dataMovingShow', true);
      const indexArray = charts.convertFromPixel('grid', [dataMovingX, dataMovingY]);
      let xIndex = indexArray[0];
      let yIndex = indexArray[1];
      if (xIndex < 0) xIndex = 0;
      if (xIndex > windowDaySpan) xIndex = windowDaySpan;
      if (yIndex < 0) yIndex = 0;
      const startDay = moment(yIndex).format('YYYY-MM-DD');
      let startTimeFormat = `${moment(yIndex).format('YYYY-MM-DD HH:mm')}`;
      const minutes = moment(startTimeFormat).format('mm');
      const num = Math.floor(minutes / 15);
      startTimeFormat = moment(startTimeFormat).minute(num * 15).format('YYYY-MM-DD HH:mm');
      const endTimeNew = `${moment(startTimeFormat).add(timeDiff, 'minutes').format('HH:mm')}`;
      const startTimeNew = moment(startTimeFormat).format('HH:mm');
      dataInfoCopy.date = this.dayList[xIndex];
      dataInfoCopy.startDay = startDay;
      dataInfoCopy.startTime = startTimeNew;
      dataInfoCopy.endTime = endTimeNew;
      dataInfoCopy.during = `${startTime} - ${endTime}`;
      const { boardData } = this;
      const dataCopy = JSON.parse(JSON.stringify(boardData));
      dataCopy.push(dataInfoCopy);
      this.$set(this, 'eChartsData', this.formatDataForECharts(dataCopy));
      this.charts.setOption({
        series: [{
          data: this.eChartsData,
        }],
      });
    },
    /**
     * @description: mouseup事件，取消事件绑定
     * @param {TimeStamp} startTime 开始时间戳
     * @return {Null}
     */
    mouseUp() {
      const { dataInfoCopy, boardData } = this;
      this.unBindDrag();
      this.$set(this, 'dataMovingShow', false);
      dataInfoCopy.isMoving = false;
      const dataCopy = boardData.map((item) => {
        if (item.id === dataInfoCopy.id) {
          item = dataInfoCopy;
        }
        return item;
      });
      this.$set(this, 'boardData', dataCopy);
      this.$set(this, 'eChartsData', this.formatDataForECharts(dataCopy));
      this.$set(this, 'dataInfoCopy', {});
      this.charts.setOption({
        series: [{
          data: this.eChartsData,
        }],
      });
    },
    unBindDrag() {
      const zr = this.charts.getZr();
      zr.off('mousemove');
      zr.off('mouseup');
      window.removeEventListener('mousemove', this.mouseMove);
      window.removeEventListener('mouseup', this.mouseUp);
    },
    // #endregion

    /**
     * @description: 获取文字宽度
     * @param {String} text 字符串
     * @param {Number} font 字体大小
     * @return {Number} 字符串宽度
     */
    getTextWidth(text, font) {
      // 创建一个临时 canvas 元素
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // 设置字体样式
      ctx.font = `${font}px PingFangSC-Medium`;
      // 获取文本宽度并返回
      return ctx.measureText(text).width;
    },
    /**
     * @description: 获取字符串字节长度
     * @param {String} str 字符串
     * @return {Number} 长度
     */
    getLength(str) {
      // eslint-disable-next-line no-control-regex
      return str.replace(/[^\x00-\xff]/g, 'xx').length;
    },
    /**
     * @description: 根据n截取字符串，汉字算两个字符
     * @param {String} str 字符串
     * @param {Number} n 截取长度
     * @return {Null}
     */
    // eslint-disable-next-line consistent-return
    realSubstring(str, n) {
      if (this.getLength(str) <= n) {
        return str;
      }
      for (let i = 0; i < str.length; i += 1) {
        const charCode = str.charCodeAt(i);
        if (charCode >= 0 && charCode <= 128) {
          n -= 1;
        } else {
          n -= 2;
        }
        if (n < 0) {
          return `${str.substring(0, i)}...`;
        }
      }
    },
    /**
     * @description： 获取日期在日期列表中的索引
     * @param {String} day 日期
     * @return {Null}
     */
    getDayIndex(day) {
      return this.dayList.indexOf(day);
    },
    getWeekName(date) {
      const weekday = moment(date).weekday()
      return `星期${'日一二三四五六'.charAt(weekday)}`;
    },
    /**
     * @description: 创建矩形元素
     * @param {Object} params renderItem 参数列表
     * @param {Object} rect 矩形信息
     * @return {Null}
     */
    clipRectByRect(params, rect) {
      const shape = echarts.graphic.clipRectByRect(rect, {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height,
      });
      return shape;
    },
    /**
     * @description: 获取背景元素
     * @param {Object} target 目标元素
     * @param {String} id 数据id
     * @return {Object}
     */
    getBackgroundRect(target, id) {
      // 递归查找name===main的children
      while (target) {
        if (target.name === 'main') {
          return (target._children && target._children.find(item => item.extra && item.extra._id === id)) || target._children[0];
        }
        target = target.parent;
      }
      return target;
    },
  },

}
</script>
<style lang="less">
.board {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: #f5f5f5;
  #view {
    width: 100%;
    height: 100%;
  }
}
.moving {
  position: absolute;
  border: 1px solid #FFFFFF;
  background-color: #6373FF;
  pointer-events: none;
  border-radius: 8px;
  box-shadow: 0px 2px 8px 0px #868DD2;
  z-index: 10000000;
  overflow: hidden;
  padding: 8px 2px;
  .title {
    font-size: 12px;
    color: #FFFFFF;
    margin-left: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .content {
    display: flex;
    color: #C0C7FF;
    font-size: 10px;
    line-height: 16px;
    margin-left: 16px;
    height: 16px;
    .label {
      width: 30px;
      text-align: justify;
      margin-right: 4px;
      &::after {
        display: inline-block;
        width: 100%;
        content: '';
      }
    }
  }

  &.from-tooltip {
    .title {
      line-height: 28px;
    }
  }
}
</style>