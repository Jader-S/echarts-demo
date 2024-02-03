<template>
  <div class="board" ref="board" v-loading="loading">
    <div id="view" ref="view" @contextmenu.prevent></div>
    <div
      v-if="cfrInfoCopy.cfrTheme"
      :class="['moving', cfrInfoCopy.isOwner && 'is-owner', fromTooltip && 'from-tooltip']"
      :style="{left: cfrMovingX+'px', top: cfrMovingY+'px', height: cfrMovingHeight+'px', width: cfrMovingWidth+'px',display: cfrMovingShow ? 'block': 'none' }"
      >
      <div class="title">
        {{ cfrInfoCopy.cfrTheme }}
      </div>
      <template v-if="!fromTooltip">
        <div class="content">
          <div class="label">主持人</div>
          <div class="item">
            {{ cfrInfoCopy.hostName }}
          </div>
        </div>
        <div class="content">
          <div class="label">会议室</div>
          <div class="item">
            {{ cfrInfoCopy.roomName }}
          </div>
        </div>
        <div class="content">
          <div class="label">时   间</div>
          <div class="item">
            {{ cfrInfoCopy.during }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
<script>
// eslint-disable global-require
// eslint-disable-next-line import/no-extraneous-dependencies
import * as echarts from 'echarts';
import { mapState } from 'vuex';
import moment from 'moment';
import { isEmpty, get } from 'lodash';
import { getWeekName } from '@/util/dateUtil';

export default {
  props: {
    spaceBoard: {
      type: Object,
      default: () => {
      },
    },
    showSubmitDetail: {
      type: Function,
      default: null,
    },
    showContextMenu: {
      type: Function,
      default: null,
    },
    submitList: {
      type: Array,
      default: () => [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      chart: null,
      uid: '',
      isCreator: false,
      loading: true,
      view: null,
      dayWidth: 0,
      percent: 0,
      currentDataZoomXStart: 0,
      currentDataZoomXEnd: 0,
      currentDataZoomYStart: 0,
      currentDataZoomYEnd: 0,

      // 可配置参数
      windowTimeSpan: 8, // 窗口内时间跨度  可选5,6,7,8
      windowDaySpan: 5, // 窗口内日期跨度 可选1 ~ 7  默认5
      dayStartValue: 0, // 窗口开始日期 默认0
      dayList: [],
      conferenceData: [],

      // 拖拽相关
      cfrInfoCopy: {},
      cfrMovingX: 0,
      cfrMovingY: 0,
      cfrMovingWidth: 0,
      cfrMovingHeight: 0,
      diffX: 0,
      diffY: 0,
      cfrMovingShow: false,
      mouseDownStartTime: 0,
      fromTooltip: false,
      activeSubmit: null,
    };
  },
  computed: {
    ...mapState({
      loginedUser: state => state.people.loginedUser,
      timeRange: state => state.matchSpace.timeRange,
      timeGrain: state => state.matchSpace.timeGrain,
    }),
    headerDom() {
      return document.getElementsByClassName('el-header')[0];
    },
    contentHeaderDom() {
      return document.getElementsByClassName('content-header')[0];
    },
    operateDom() {
      return document.getElementsByClassName('content-operate')[0];
    },
    sideDom() {
      return document.getElementsByClassName('match-space-side')[0];
    },
    widthDiff() {
      const { sideDom } = this;
      const sideWidth = sideDom.clientWidth;
      return sideWidth + 16;
    },
    heightDiff() {
      const { headerDom, contentHeaderDom, operateDom } = this;
      let headerHeight;
      let contentHeaderHeight;
      let operateHeight;
      if (!isEmpty(headerDom)) {
        headerHeight = headerDom.clientHeight;
      }
      if (!isEmpty(contentHeaderDom)) {
        contentHeaderHeight = contentHeaderDom.clientHeight;
      }
      if (!isEmpty(operateDom)) {
        operateHeight = operateDom.clientHeight;
      }
      return headerHeight + contentHeaderHeight + operateHeight + 16;
    },
    timeStartValue() {
      const startTime = get(this, 'timeRange.startTime', '09:00');
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
      const startTime = get(this, 'timeRange.startTime', '09:00');
      const result = `${moment().format('YYYY-MM-DD')} ${startTime}`;
      return moment(result).subtract(10, 'minutes').format('YYYY-MM-DD HH:mm');
    },
    timeYAaisMax() {
      const endTime = get(this, 'timeRange.endTime', '24:00');
      return `${moment().format('YYYY-MM-DD')} ${endTime}`;
    },
  },
  watch: {
    spaceBoard(val) {
      if (!isEmpty(val)) {
        this.resetCurrentScroll();
        this.initDayList();
      }
    },
    submitList(val) {
      this.setHeightLight();
      this.$set(this, 'conferenceData', this.formatCfrData(val));
      this.initView();
    },
  },
  methods: {
    moment,
    // #region 视图渲染
    init() {
      const { creatorUid } = this.spaceBoard;
      const { _id } = this.loginedUser;
      this.$set(this, 'isCreator', _id === creatorUid);
    },
    initView() {
      const viewDom = this.$refs.view;
      if (!isEmpty(this.chart)) {
        this.chart.dispose();
      }
      this.chart = echarts.init(viewDom, null, { renderer: 'svg' });
      this.chart.on('contextmenu', this.oncontextmenu);
      window.conferenceClick = this.conferenceClick;
      window.conferenceContextmenu = this.conferenceContextmenu;
      window.closeTooltip = this.closeTooltip;
      this.setDayWidth();
      // 窗口resize时自动更新echarts
      this.$nextTick(() => {
        const resizeOb = new ResizeObserver(() => {
          this.updateView();
        });
        resizeOb.observe(this.$refs.board);
        this.bindDrag();
        this.loading = false;
      });
    },
    updateView() {
      this.setDayWidth();
      this.chart.setOption(this.markOption());
      this.chart.resize();
      this.loading = false;
    },
    /**
     * @description: 构建option
     * @return {Null}
     */
    markOption() {
      const {
        percent, dayWidth, windowDaySpan, currentDataZoomXStart, currentDataZoomXEnd, currentDataZoomYStart, currentDataZoomYEnd,
      } = this;
      const option = {
        grid: {
          top: 20 * percent,
          left: 20 * percent,
          right: 20 * percent,
          bottom: 20 * percent,
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
            minValueSpan: windowDaySpan,
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
            length: 60 * percent,
            lineStyle: {
              color: ['#EBEDF0'],
            },
          },
          axisLine: {
            lineStyle: {
              color: ['#EBEDF0'],
              width: 2 * percent,
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
            shadowBlur: 10 * percent,
            shadowOffsetX: 2 * percent,
            shadowOffsetY: 4 * percent,
          },
          axisLabel: {
            margin: 8 * percent,
            interval: 0,
            color: '#202340',
            align: 'left',
            padding: [0, 0, 0, -(dayWidth / 2) + 4 * percent],
            formatter(value) {
              return `{week|${getWeekName(value)}}\n{day|${moment(value).format('DD')}}`;
            },
            rich: {
              week: {
                fontSize: 12 * percent,
                lineHeight: 18 * percent,
                align: 'left',
                verticalAlign: 'middle',
              },
              day: {
                fontSize: 24 * percent,
                lineHeight: 29 * percent,
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
              y: [2, 3],
            },
            renderItem: this.renderItem,
            data: this.conferenceData,
            animation: false,
            universalTransition: {
              enabled: true,
              divideShape: 'split',
            },
          },
        ],
      };
      if (currentDataZoomXStart) {
        option.dataZoom[2].start = currentDataZoomXStart;
        option.dataZoom[2].end = currentDataZoomXEnd;
      }
      if (currentDataZoomYStart) {
        option.dataZoom[0].start = currentDataZoomYStart;
        option.dataZoom[0].end = currentDataZoomYEnd;
      }
      return option;
    },
    /**
     * @description: 自定义渲染逻辑
     * @param {Object} params 元素参数
     * @param {Object} api 坐标系接口
     * @return {Null}
     */
    renderItem(params, api) {
      const dayIndex = api.value(0);
      const conference = api.value(1);
      if (isEmpty(conference)) return {};
      // 获取会议信息
      const conferenceList = JSON.parse(conference);
      const startTime = api.value(2);
      const startTimeSeat = api.coord([dayIndex, startTime]);
      const endTime = api.value(3);
      const endTimeSeat = api.coord([dayIndex, endTime]);
      const index = api.value(4);

      // 获取单个会议卡片宽高
      const barHeight = endTimeSeat[1] - startTimeSeat[1];
      const barWidth = api.size([1, 0])[0];
      const defaultBarHeight = api.coord([dayIndex, moment(startTime).add(1, 'hours')])[1] - startTimeSeat[1];

      const mainContent = this.createMainContent({
        startTimeSeat,
        barWidth,
        barHeight,
        params,
        api,
        conferenceList,
        defaultBarHeight,
        index,
      });
      if (isEmpty(mainContent)) return {};
      const contentResult = {
        type: 'group',
        name: 'main',
        children: [
          ...mainContent,
        ],
      };
      return contentResult;
    },
    // #endregion
    // #region 数据处理
    /**
     * @description: 初始化时间列表
     * @param {Object} space 撮会空间信息
     * @return {Null}
     */
    initDayList() {
      const { startDate, endDate } = this.spaceBoard;
      const daySpan = moment(endDate).diff(startDate, 'days');
      const dayList = [];
      for (let i = 0; i <= daySpan; i += 1) {
        const day = moment(startDate).add(i, 'days');
        dayList.push(day.format('YYYY-MM-DD'));
      }
      this.$set(this, 'dayList', dayList);
    },
    /**
     * @description： 获取日期在日期列表中的索引
     * @param {String} day 日期
     * @return {Null}
     */
    getDayIndex(day) {
      return this.dayList.indexOf(day);
    },
    /**
     * @description: 根据会议列表中会议时间，判断时间是否存在重叠，若重叠，则所有发成重叠的会议都添加isOverlap:true;
     * @param {*} cfrList
     * @return {Null}
     */
    setTimeOverLap(cfrList) {
      const { _id } = this.loginedUser;
      for (let i = 0; i < cfrList.length; i += 1) {
        for (let j = i + 1; j < cfrList.length; j += 1) {
          const cfr1 = cfrList[i];
          const cfr2 = cfrList[j];
          // 是否是创建者
          const isOwner1 = cfr1.creatorUid === _id;
          const isOwner2 = cfr1.creatorUid === _id;
          const { date: date1, startTime: start1, endTime: end1 } = cfr1.cfrTime;
          const { date: date2, startTime: start2, endTime: end2 } = cfr2.cfrTime;
          const startTime1 = moment(`${date1} ${start1}`);
          const endTime1 = moment(`${date1} ${end1}`);
          const startTime2 = moment(`${date2} ${start2}`);
          const endTime2 = moment(`${date2} ${end2}`);
          if (date1 === date2 && !(isOwner1 && isOwner2) && (startTime1.isBetween(startTime2, endTime2) || endTime1.isBetween(startTime2, endTime2))) {
            cfr1.isOverlap = true;
            cfr2.isOverlap = true;
          }
        }
      }
      return cfrList;
    },
    /**
     * @description: 格式化会议信息，根据会议日期，开始时间，构建会议数据
     * @param {*} conferences
     * @return {Null}
     */
    formatCfrData(conferences) {
      const { loginedUser } = this;
      const { _id } = loginedUser;
      const cfrMap = new Map();
      const conferenceList = this.setTimeOverLap([...conferences]);
      const baseDate = moment().format('YYYY-MM-DD');
      conferenceList.forEach((cfr) => {
        const { cfrTime } = cfr;
        const { date, startTime, endTime } = cfrTime;
        cfr.during = `${startTime} - ${endTime}`;
        // 是否是创建者
        cfr.isOwner = cfr.creatorUid === _id;
        // 是否是参会人
        cfr.isAttendee = cfr.attendUidList.includes(_id);
        // 构建会议数据
        // 构建eCharts series 单个元素数据
        const contentInfo = [
          this.getDayIndex(date),
          JSON.stringify([cfr]),
          moment(`${baseDate} ${startTime}`).format('YYYY-MM-DD HH:mm'),
          `${baseDate} ${endTime}`,
        ];
        // 若已存在当天会议数据，则更新当天会议数据列表
        if (cfrMap.has(date)) {
          cfrMap.set(date, this.buildCfrDataByTime(cfrMap.get(date), contentInfo));
        } else {
          cfrMap.set(date, [contentInfo]);
        }
      });
      const cfrMapArray = Array.from(cfrMap.values());
      let cfrData = [];
      for (let i = 0; i < cfrMapArray.length; i += 1) {
        const cfrList = cfrMapArray[i];
        cfrData.push(...cfrList);
      }
      cfrData = this.sortCfrData(cfrData);
      cfrData.forEach((item, index) => {
        item[4] = index;
      });
      cfrData = this.getDisabledTimeList().concat(cfrData);
      return cfrData;
    },
    /**
     * @description: 会议数据排序
     * @param {Array} cfrData 会议数据
     * @return {*}
     */
    sortCfrData(cfrData) {
      return cfrData.sort((a, b) => {
        const cfrA = JSON.parse(a[1])[0];
        const cfrB = JSON.parse(b[1])[0];
        const { cfrTime: cfrTime1, isMoving: isMoving1, isOwner: isOwner1 } = cfrA;
        const { startTime: start1, date: date1 } = cfrTime1;
        const { cfrTime: cfrTime2, isMoving: isMoving2, isOwner: isOwner2 } = cfrB;
        const { startTime: start2, date: date2 } = cfrTime2;
        // 若数据为当前拖动中，则排到最后
        if (isMoving1 || isMoving2) return isMoving1 - isMoving2;
        // 若会议角色是创建者，则覆盖其他会议
        if ((isOwner1 || isOwner2) && !(isOwner1 && isOwner2)) return isOwner1 - isOwner2;
        // 若正常数据，则根据当天时间排序，后面的数据覆盖前面的
        return moment(`${date1} ${start1}`).isAfter(moment(`${date2} ${start2}`)) ? 1 : -1;
      });
    },
    /**
     * @description: 设置高亮
     * @return {*}
     */
    setHeightLight() {
      const { activeSubmit, submitList } = this;
      if (isEmpty(activeSubmit)) return;
      this.setActiveCfr(submitList, activeSubmit._id);
    },
    /**
     * @description: 将开始时间相同的会议数据添加到一个数据中
     * @param {Array} contentInfoList 某天的会议列表
     * @param {Array} contentInfo 需要添加到列表的数据
     * @return {Null}
     */
    buildCfrDataByTime(contentInfoList, contentInfo) {
      let cfrMap = new Map();
      contentInfoList.forEach((contentInfoItem) => {
        cfrMap = this.makeCfrMap(cfrMap, contentInfoItem);
      });
      cfrMap = this.makeCfrMap(cfrMap, contentInfo);
      return Array.from(cfrMap.values());
    },
    /**
     * @description: 创建会议Map
     * @param {Map} cfrMap 会议Map
     * @param {Array} contentInfo 会议信息
     * @return {*}
     */
    makeCfrMap(cfrMap, contentInfo) {
      const cfrTime = contentInfo[2];
      const cfrTimeHour = moment(cfrTime).format('YYYY-MM-DD HH:mm');
      if (cfrMap.has(cfrTimeHour)) {
        const cfrListOnOneTime = cfrMap.get(cfrTimeHour);
        const list = JSON.parse(cfrListOnOneTime[1]);
        const cfrOnTime = JSON.parse(contentInfo[1])[0];
        // 如果list中没有此id
        if (!list.find(item => item._id === cfrOnTime._id)) {
          list.push(cfrOnTime);
        }
        // 将本人预约排序到最上方
        list.sort((a, b) => b.isOwner - a.isOwner);
        cfrListOnOneTime[1] = JSON.stringify(list);
        cfrMap.set(cfrTimeHour, cfrListOnOneTime);
      } else {
        cfrMap.set(cfrTimeHour, contentInfo);
      }
      return cfrMap;
    },
    // #endregion
    // #region 创建元素相关
    /**
     * @description: 创建主体元素
     * @param {Object} startTimeSeat 开始位置坐标
     * @param {Number} barWidth 宽度
     * @param {Number} barHeight 高度
     * @param {Object} params renderItem 参数
     * @param {Object} api 坐标系接口
     * @param {Array} conferenceList 会议列表
     * @param {Number} defaultBarHeight 默认高度
     * @param {Number} index 索引
     * @return {Null}
     */
    createMainContent({
      startTimeSeat,
      barWidth,
      barHeight,
      params,
      api,
      conferenceList,
      defaultBarHeight,
      index,
    }) {
      const conference = conferenceList[0];
      let backgroundRectList = [];
      let themeContentList = [];
      let meetingContent = {};
      let disabledRect = [];
      if (isEmpty(conferenceList)) {
        disabledRect = this.createDisabledRect({
          params,
          startTimeSeat,
          barWidth,
          barHeight,
        });
      } else {
        const {
          cfrTheme,
          isOwner,
          isOverlap,
          isAttendee,
          isMoving,
          isActive,
        } = conference;
        // 获取第一个会议ID
        let { _id } = conference;
        if (conferenceList.length > 1) {
          // 若当前时间段有多个会议，则将id置空
          _id = '';
        }
        const haveOwner = conferenceList.some(item => item.isOwner);
        // 若当前时间段只有一个会议，则点击卡片也可以打开会议详情（传入会议ID）
        backgroundRectList = [this.createBackgroundRect({
          params,
          startTimeSeat,
          barWidth,
          barHeight,
          isOwner: haveOwner,
          isOverlap,
          isAttendee,
          _id,
          isActive,
          isMoving,
          index,
        })];
        // 计算主题宽度
        const cfrThemeWidth = this.getTextWidth(cfrTheme, 12);
        // 计算单个文字宽度
        const perWidth = cfrThemeWidth / this.getLength(cfrTheme);
        // 计算剪切长度
        const cutLength = Math.floor((barWidth - 36) / perWidth);
        // 计算主题高度
        const perHeight = defaultBarHeight / 3;
        // 计算主题间距
        const distance = (perHeight - 12) / 2;

        if (conferenceList.length > 1) {
          // themeFormat = '';
          let fill = '#000000';
          const elseArr = conferenceList.slice(1);
          if (haveOwner) {
            fill = '#FFFFFF';
          }
          themeContentList = this.createThemeContentList({
            params,
            startTimeSeat,
            barWidth,
            perHeight,
            distance,
            conferenceList,
            cutLength,
            isOwner,
            fill,
            haveOwner,
            isActive,
            index,
          });
          backgroundRectList = backgroundRectList.concat(this.createBackgroundRectList({
            params,
            api,
            elseArr,
            startTimeSeat,
            barWidth,
            haveOwner,
            index,
          }));
        } else {
          meetingContent = this.createMeetingContentList({
            params,
            startTimeSeat,
            barWidth,
            perHeight,
            distance,
            conference,
            cutLength,
            barHeight,
            defaultBarHeight,
            isOwner,
            isOverlap,
            isMoving,
            isActive,
            index,
          });
        }
      }
      // 构建主体元素
      const mainContent = [
        // 背景
        ...backgroundRectList,
        // 主题
        ...themeContentList,
      ];
      if (!isEmpty(meetingContent)) {
        mainContent.push(meetingContent);
      }
      if (!isEmpty(disabledRect)) {
        mainContent.push(disabledRect);
      }
      return mainContent;
    },
    /**
     * @description: 创建背景块列表
     * @param {Object} params 元素参数
     * @param {Object} api 坐标系接口
     * @param {String} elseArr 其他会议列表
     * @param {Object} startTimeSeat 开始位置坐标
     * @param {Number} barWidth 元素宽度
     * @param {Boolean} haveOwner 是否是创建者
     * @return {Array} 背景元素列表
     */
    createBackgroundRectList({
      params,
      api,
      elseArr,
      startTimeSeat,
      barWidth,
      haveOwner,
      index,
    }) {
      elseArr.sort((a, b) => {
        if (a.isOwner === b.isOwner) {
          return moment(b.endTime).diff(a.endTime);
        }
        return a.isOwner ? -1 : 1;
      });
      const length = elseArr.length >= 3 ? 3 : elseArr.length;
      const backgroundRectList = [];
      for (let i = 0; i < length; i += 1) {
        const {
          cfrTime,
          isAttendee,
          isOverlap,
        } = elseArr[i];
        const { endTime, date } = cfrTime;
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
          isOwner: haveOwner,
          isAttendee,
          isOverlap,
          index,
        });
        backgroundRectList.push(backgroundRect);
      }
      return backgroundRectList;
    },
    /**
     * @description:
     * @param {Object} params 元素参数
     * @param {Object} startTimeSeat 开始位置坐标
     * @param {Number} barWidth 元素宽度
     * @param {Number} barHeight 元素高度
     * @param {Boolean} isOwner 是否是创建者
     * @param {Boolean} isAttendee 是否是参会者
     * @param {Boolean} isOverlap 元素是否重叠
     * @param {String} _id 会议id
     * @param {Boolean} isActive 是否是当前会议
     * @param {Boolean} isMoving 是否在拖拽
     * @param {Number} index 会议列表索引
     * @return {Null}
     */
    createBackgroundRect({
      params,
      startTimeSeat,
      barWidth,
      barHeight,
      isOwner,
      isAttendee,
      isOverlap,
      _id,
      isActive,
      isMoving,
      index,
    }) {
      let rectFill;
      let strokeFill = '#FFFFFF';
      if (isOwner) {
        if (isMoving) {
          rectFill = '#6373FF80';
        } else if (isActive) {
          rectFill = '#535FC7';
        } else {
          rectFill = '#6373FF';
        }
      } else if (isOverlap || (!this.isSystem && !isAttendee)) {
        rectFill = '#FF00000D';
      } else {
        rectFill = '#F2F4FF';
      }
      let x = startTimeSeat[0] - barWidth / 2 + 1;
      let width = barWidth - 2;
      if (isOwner && isOverlap) {
        x += 5;
        width -= 5;
      }
      // 创建卡片主体矩形元素
      const backgroundRectShape = this.clipRectByRect(params, {
        x: x + 2,
        y: startTimeSeat[1] + 2,
        width: width - 4,
        height: barHeight - 4,
      });
      // 设置圆角
      if (backgroundRectShape) {
        backgroundRectShape.r = [6, 6, 6, 6];
      }
      let z2 = 8;
      if (isOwner) {
        z2 += (index + 1);
      }
      if (isOverlap) {
        z2 += 1;
      }
      if (isActive && !isMoving) {
        strokeFill = '#202340';
        z2 += this.conferenceData.length;
      }
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
          z2: z2 + this.conferenceData.length,
        },
        style: {
          fill: rectFill,
          stroke: strokeFill,
          overflow: 'hidden',
        },
        // 将会议id保存至背景卡牌
        extra: {
          _id,
        },
      };
      return backgroundRect;
    },
    /**
     * @description: 创建禁用范围卡片
     * @param {*} params
     * @param {*} startTimeSeat
     * @param {*} barWidth
     * @param {*} barHeight
     * @return {*}
     */
    createDisabledRect({
      params,
      startTimeSeat,
      barWidth,
      barHeight,
    }) {
      const x = startTimeSeat[0] - barWidth / 2 + 1;
      const width = barWidth;
      const rectFill = '#D7D8E799';
      // 创建卡片主体矩形元素
      const backgroundRectShape = this.clipRectByRect(params, {
        x,
        y: startTimeSeat[1],
        width,
        height: barHeight,
      });
      // 背景
      const backgroundRect = {
        type: 'rect',
        ignore: !backgroundRectShape,
        shape: backgroundRectShape,
        z2: 0,
        emphasisDisabled: true,
        emphasis: {
          style: {
            fill: rectFill,
          },
        },
        style: {
          fill: rectFill,
          overflow: 'hidden',
        },
      };
      return backgroundRect;
    },
    /**
     * @description: 创建会议信息列表元素
     * @param {Object} params renderItem 参数列表
     * @param {Array} conferenceList 会议列表
     * @param {Object} startTimeSeat 开始时间坐标
     * @param {Number} barWidth 元素宽度
     * @param {Number} perHeight 单个元素高度
     * @param {Number} distance 主题间距
     * @param {Number} cutLength 剪切长度
     * @param {String} fill 填充颜色
     * @param {Boolean} haveOwner 是否是创建者
     * @return {Array} 会议信息列表
     */
    createThemeContentList({
      params,
      conferenceList,
      startTimeSeat,
      barWidth,
      perHeight,
      distance,
      cutLength,
      fill,
      haveOwner,
      isActive,
      index,
    }) {
      const conferenceObj = conferenceList[0];
      const elseArr = conferenceList.slice(1);
      const length = elseArr.length > 2 ? 2 : elseArr.length;
      // const { length } = elseArr;
      const themeReactShape = this.clipRectByRect(params, {
        x: startTimeSeat[0] - barWidth / 2 + 5,
        y: startTimeSeat[1] + distance,
        width: barWidth,
        height: perHeight,
      });
      if (!themeReactShape) return [];
      const themeContentList = [];
      const themeContent = this.createThemeContent({
        shape: themeReactShape, conference: conferenceObj, cutLength, fill, haveOwner, index, isActive,
      });
      if (!isEmpty(themeContent)) {
        themeContentList.push(themeContent);
      }
      for (let i = 0; i < length; i += 1) {
        const elseThemeReactShape = this.clipRectByRect(params, {
          x: startTimeSeat[0] - barWidth / 2 + 5,
          y: startTimeSeat[1] + (i + 1) * perHeight + distance,
          width: barWidth,
          height: perHeight,
        });
        themeContentList.push(this.createLineContent(elseThemeReactShape, distance, index));
        if (elseArr.length > 2 && i === 1) {
          themeContentList.push(this.createThemeContent({
            shape: elseThemeReactShape, conference: { cfrTheme: `还有${elseArr.length - 1}项...`, type: 'remind' }, cutLength, fill, haveOwner, index, isActive,
          }));
        } else {
          themeContentList.push(this.createThemeContent({
            shape: elseThemeReactShape, conference: elseArr[i], cutLength, fill, haveOwner, index, isActive,
          }));
        }
      }
      return themeContentList;
    },
    /**
     * @description: 创建主题元素
     * @param {Object} shape 主题矩形
     * @param {Object} conference 会议信息
     * @param {Number} cutLength 剪切长度
     * @param {String} fill 填充颜色
     * @param {Boolean} haveOwner 是否是创建者
     * @param {Boolean} isOverlap 是否重叠
     * @return {Object} 主题元素
     */
    createThemeContent({
      shape, conference, cutLength, fill, haveOwner, isOverlap, index, isActive,
    }) {
      if (isEmpty(shape)) return;
      const {
        _id,
        state,
        isAttendee,
        isOwner,
      } = conference;
      let { cfrTheme } = conference;
      const { isSystem } = this;
      let image = this.getIcon(state, haveOwner);
      if (!isAttendee && !isSystem && !isOwner) {
        cfrTheme = '';
        image = '';
      }
      let x = shape.x + 18;
      let width = shape.width - 36;
      if (haveOwner && isOverlap) {
        x += 5;
        width -= 5;
      }
      let z2 = 10 + index;
      if (haveOwner) {
        z2 += 2;
      }
      if (isActive) {
        z2 += this.conferenceData.length;
      }
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
              text: this.realSubstring(`${cfrTheme}`, cutLength),
              overflow: 'hidden',
              fontSize: 12,
            },
            emphasis: {
              style: {
                fill,
              },
              z2: z2 + this.conferenceData.length,
            },
            textConfig: {
              position: 'insideTopLeft',
              inside: true,
              style: {
                overflow: 'hidden',
              },
            },
            extra: {
              _id,
            },
          }, {
            type: 'image',
            z2,
            style: {
              image,
              x: x - 15,
              y: shape.y,
            },
            emphasis: {
              z2: z2 + this.conferenceData.length,
            },
          },
        ],
      };
    },
    /**
     * @description: 创建会议信息列表元素
     * @param {Object} params renderItem 参数列表
     * @param {Object} startTimeSeat 开始时间坐标
     * @param {Number} barWidth 元素宽度
     * @param {Number} barHeight 元素高度
     * @param {Number} perHeight 单个元素高度
     * @param {Number} distance 间距
     * @param {Object} conference 会议信息
     * @param {Number} cutLength 剪切长度
     * @param {Number} barHeight 元素高度
     * @param {Number} defaultBarHeight 默认元素高度
     * @param {Boolean} isOwner 是否是创建者
     * @param {Boolean} isOverlap 是否重叠
     * @param {Boolean} isMoving 是否移动中
     * @return {Array} 会议信息列表
     */
    createMeetingContentList({
      params,
      startTimeSeat,
      barWidth,
      perHeight,
      distance,
      conference,
      cutLength,
      barHeight,
      defaultBarHeight,
      isOwner,
      isOverlap,
      isMoving,
      isActive,
      index,
    }) {
      let fill = '#000000';
      if (isOwner) {
        if (isMoving) {
          fill = '#C0C7FF';
        } else {
          fill = '#FFFFFF';
        }
      }
      const themeShape = this.clipRectByRect(params, {
        x: startTimeSeat[0] - barWidth / 2 + 5,
        y: startTimeSeat[1] + distance,
        width: barWidth,
        height: perHeight,
      });
      const themeContent = this.createThemeContent({
        shape: themeShape, conference, cutLength, fill, haveOwner: isOwner, isOverlap, index, isActive,
      });
      const meetingContent = {
        type: 'group',
        children: [],
      };
      if (!isEmpty(themeContent)) {
        meetingContent.children.push(themeContent);
      }
      const {
        cfrTheme, _id, isAttendee, cfrTime,
      } = conference;
      const { isSystem, timeGrain } = this;
      if ((isSystem || isOwner || isAttendee)) {
        const propertyList = [
          'hostName',
          'roomName',
          'during'];
        const propertyPerHeight = defaultBarHeight / 3 * 2 / 3;
        const propertyWidth = this.getTextWidth(cfrTheme, 10);
        const propertyPerWidth = propertyWidth / this.getLength(cfrTheme);
        const propertyCutLength = Math.floor((barWidth - 30) / propertyPerWidth);
        const {
          date,
          startTime,
          endTime,
        } = cfrTime;
        const submitStart = moment(`${date} ${startTime}`);
        const submitEnd = moment(`${date} ${endTime}`);
        const timeDiff = submitEnd.diff(submitStart, 'minutes');
        let num = Math.floor(timeDiff / timeGrain);
        num = num > 4 ? 4 : num;
        for (let i = 0; i < num - 1; i += 1) {
          const key = propertyList[i];
          const conferenceShape = this.clipRectByRect(params, {
            x: startTimeSeat[0] - barWidth / 2 + 5,
            y: startTimeSeat[1] + (i + 1) * propertyPerHeight + distance,
            width: barWidth,
            height: propertyPerHeight,
          });
          if (!isEmpty(conferenceShape)) {
            meetingContent.children.push(this.createMeetingContent(conferenceShape, key, conference[key], propertyCutLength, isOwner, isActive, _id, index));
          }
        }
      }
      return meetingContent;
    },
    /**
     * @description: 创建会议信息元素
     * @param {Object} shape 矩形
     * @param {String} key 属性名称
     * @param {String} value 属性值
     * @param {Number} cutLength 剪切长度
     * @param {Boolean} isOwner 是否是创建者
     * @param {Boolean} isActive 是否是当前会议
     * @param {String} _id 会议id
     * @return {Object} 会议信息元素
     */
    createMeetingContent(shape, key, value, cutLength, isOwner, isActive, _id, index) {
      const keyMap = {
        hostName: '主持人',
        roomName: '会议室',
        during: '时   间',
      };
      let fill = '#8E92B3';
      if (isOwner) {
        if (isActive) {
          fill = '#FFFFFF';
        } else {
          fill = '#C0C7FF';
        }
      }
      let z2 = 10;
      if (isOwner) {
        z2 += index;
      }
      if (isActive) {
        z2 += this.conferenceData.length;
      }
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
            emphasis: {
              style: {
                fill,
              },
              z2: z2 + this.conferenceData.length,
            },
            style: {
              fill,
              text: this.realSubstring(`${keyMap[key]} ${value}`, cutLength),
              overflow: 'hidden',
              fontSize: 10,
            },
            textConfig: {
              position: 'insideTopLeft',
              inside: true,
              style: {
                overflow: 'hidden',
              },
            },
            extra: {
              _id,
            },
          },
        ],
      };
    },
    /**
     * @description: 创建线元素
     * @param {Object} shape 矩形
     * @param {Number} translateY 间距
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
          z2: z2 + this.conferenceData.length,
        },
      };
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
    // #endregion
    // #region 弹窗相关
    /**
     * @description: 渲染 tooltip 内容
     * @param {*} params
     * @return {Null}
     */
    tooltipFormatter(params) {
      const { data } = params;
      const conferenceList = JSON.parse(data[1]);
      const startTime = data[2];
      if (conferenceList.length <= 3) {
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
      conferenceList.forEach((item) => {
        const {
          cfrTheme,
          isOwner,
          state,
          _id,
        } = item;
        const $item = JSON.stringify(item).replace(/\"/g, "'");
        result += `<div style="font-size: 14px;
                      background-color: ${isOwner ? '#6373FF' : '#FF00000D'};
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
                      oncontextmenu="conferenceContextmenu({id:'${_id}',position:{
                        x:event.layerX,
                        y:event.layerY,
                      }})">`;
        const iconUrl = this.getIcon(state, isOwner);
        if (!isEmpty(iconUrl)) {
          result += `<img src="${iconUrl}" style="width: 14px;height: 14px;margin-left:2px;
                      vertical-align: middle;">`;
        }
        result += `<span style="color: ${isOwner ? '#fff' : '#000'};vertical-align: middle;margin-left: 2px;">${cfrTheme}</span>
          </div>`;
      });
      result += '</div>';
      // const
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
    // #region 点击事件相关
    /**
     * @description: 会议卡片点击事件
     * @param {Object} params 点击事件参数
     * @return {Null}
     */
    contentClick({ params, _id }) {
      // 获取会议id，若当前卡片只有一个id，则点击卡片可以跳转到会议详情页面，否则，点击会议主题跳转
      const id = get(params, 'target.extra._id', get(params, 'target.parent.extra._id', ''));
      if (!isEmpty(id)) {
        // 若存在会议ID，则触发会议点击事件
        this.conferenceClick({ id });
      } else {
        this.conferenceClick({ id: _id });
      }
    },
    /**
     * @description: 会议点击事件
     * @param {String} id 会议id
     * @return {Null}
     */
    conferenceClick({ id }) {
      this.showSubmitDetail(id);
      this.closeTooltip();
    },
    /**
     * @description: 会议右键事件
     * @param {String} id 会议id
     * @return {Null}
     */
    conferenceContextmenu({ id, position }) {
      this.showContextMenu({ id, position });
      this.unBindDrag();
    },
    /**
     * @description: 会议卡片右键点击事件
     * @param {Object} params 点击事件参数
     * @return {Null}
     */
    oncontextmenu(params) {
      const event = get(params, 'event', {});
      // 获取会议id，若当前卡片只有一个id，则点击卡片直接展示右键菜单，否则，点击会议主题跳转
      const id = get(event, 'target.extra._id', get(event, 'target.parent.extra._id', ''));
      const offsetX = get(event, 'offsetX', 0);
      const offsetY = get(event, 'offsetY', 0);
      const position = {
        x: offsetX,
        y: offsetY,
      };
      if (!isEmpty(id)) {
        this.conferenceContextmenu({ id, position });
      }
    },
    // #endregion

    // #region 拖拽相关
    /**
     * @description: 绑定拖拽事件
     * @return {Null}
     */
    bindDrag() {
      this.chart.on('mousedown', (params) => {
        const event = get(params, 'event', {});
        // 获取会议id
        const id = get(event, 'target.extra._id', get(event, 'target.parent.extra._id', ''));
        if (!isEmpty(id)) {
        // 若存在会议ID，则触发会议点击事件
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
      this.$set(this, 'cfrMovingX', clientX - diffX);
      this.$set(this, 'cfrMovingY', clientY - diffY);
      this.$set(this, 'cfrMovingWidth', width);
      this.$set(this, 'cfrMovingHeight', height);
    },
    /**
     * @description: 点击tooltip内会议触发事件
     * @param {Object} cfrInfo 会议信息
     * @param {Object} event 事件对象
     * @return {Null}
     */
    tooltipMouseDown(cfrInfo, event) {
      cfrInfo.isMoving = true;
      if (!cfrInfo.isOwner && !this.isSystem) return;
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
      const startTime = new Date();
      const cfrInfoCopy = JSON.parse(JSON.stringify(cfrInfo));
      this.$set(this, 'cfrInfoCopy', cfrInfoCopy);
      this.$set(this, 'startTime', startTime);
      window.addEventListener('mousemove', this.mouseMove);
      window.addEventListener('mouseup', this.mouseUp);
    },
    /**
     * @description: mousedown事件 绑定拖拽
     * @param {Object} params 事件参数
     * @param {String} id 会议id
     * @return {Null}
     */
    mouseDown(params, id) {
      const zr = this.chart.getZr();
      const { value } = params;
      const cfrListInOneTime = JSON.parse(value[1]);
      const cfrInfo = cfrListInOneTime.find(item => item._id === id);
      cfrInfo.isMoving = true;
      if (!cfrInfo.isOwner && !this.isSystem) return;
      this.$set(this, 'fromTooltip', false);
      const target = get(params, 'event.target', {});
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
      const mouseDownStartTime = new Date();
      const cfrInfoCopy = JSON.parse(JSON.stringify(cfrInfo));
      this.$set(this, 'mouseDownStartTime', mouseDownStartTime);
      this.$set(this, 'cfrInfoCopy', cfrInfoCopy);
      zr.on('mousemove', (params) => {
        this.mouseMove(params, true);
      });
      zr.on('mouseup', (params) => {
        this.mouseUp(params);
        this.$set(this, 'cfrInfoCopy', { });
      });
    },
    /**
     * @description: mouseMove事件，拖拽元素移动
     * @param {Object} params 事件参数
     * @param {Object} cfrInfo 会议信息
     * @return {Null}
     */
    mouseMove(params, isMouseDown) {
      const { state } = this.spaceBoard;
      const stateList = ['提报中', '撮合中'];
      const canDrag = stateList.includes(state);
      if (!canDrag) return;
      const { cfrInfoCopy, timeGrain } = this;
      const {
        chart, diffX, diffY, widthDiff, heightDiff,
      } = this;
      const {
        offsetX, offsetY, clientX, clientY,
      } = params;
      let cfrMovingX = offsetX - diffX;
      let cfrMovingY = offsetY - diffY;
      if (!isMouseDown) {
        cfrMovingX = clientX - diffX - widthDiff;
        cfrMovingY = clientY - diffY - heightDiff;
      }
      const { startTime, endTime, date } = cfrInfoCopy.cfrTime;
      const timeDiff = moment(`${date} ${endTime}`).diff(moment(`${date} ${startTime}`), 'minutes');
      this.$set(this, 'cfrMovingX', cfrMovingX);
      this.$set(this, 'cfrMovingY', cfrMovingY);
      this.$set(this, 'cfrMovingShow', true);
      const indexArray = chart.convertFromPixel('grid', [cfrMovingX, cfrMovingY]);
      const xIndex = indexArray[0];
      const yIndex = indexArray[1];
      const startDay = moment(yIndex).format('YYYY-MM-DD');
      let startTimeFormat = `${moment(yIndex).format('YYYY-MM-DD HH:mm')}`;
      const minutes = moment(startTimeFormat).format('mm');
      const num = Math.floor(minutes / timeGrain);
      startTimeFormat = moment(startTimeFormat).minute(num * timeGrain).format('YYYY-MM-DD HH:mm');
      const endTimeNew = `${moment(startTimeFormat).add(timeDiff, 'minutes').format('HH:mm')}`;
      const startTimeNew = moment(startTimeFormat).format('HH:mm');
      cfrInfoCopy.cfrTime = {
        date: this.dayList[xIndex],
        startDay,
        startTime: startTimeNew,
        endTime: endTimeNew,
      };
      cfrInfoCopy.during = `${startTime} - ${endTime}`;
      const { submitList } = this;
      const submitListCopy = JSON.parse(JSON.stringify(submitList));
      submitListCopy.push(cfrInfoCopy);
      this.$set(this, 'conferenceData', this.formatCfrData(submitListCopy));
      this.chart.setOption({
        series: [{
          data: this.conferenceData,
        }],
      });
    },
    /**
     * @description: mouseup事件，取消事件绑定
     * @param {Object} params 事件参数
     * @param {TimeStamp} startTime 开始时间戳
     * @return {Null}
     */
    mouseUp(params) {
      const { mouseDownStartTime, cfrInfoCopy, submitList } = this;
      this.unBindDrag();
      this.$set(this, 'cfrMovingShow', false);
      const mouseDownEndTime = new Date();
      if (mouseDownEndTime - mouseDownStartTime < 200) {
        const { _id } = cfrInfoCopy;
        this.contentClick({ params, _id });
        this.setActiveCfr(submitList, _id);
        this.saveCurrentScroll();
      } else {
        const { _id, cfrTime } = cfrInfoCopy;
        const {
          date, startDay, startTime, endTime,
        } = cfrTime;
        if (startTime === '00:00' && !moment().isSame(startDay, 'day')) {
          this.$message.error('更新失败，会议时间未在会议可预约时间内');
          this.initView();
        } else {
          const updateParams = {
            _id,
            cfrTime: {
              date,
              startTime,
              endTime,
            },
          };
          const cfrInfo = submitList.find(item => item._id === _id);
          if (JSON.stringify(cfrTime) !== JSON.stringify(cfrInfo.cfrTime)) {
            this.saveCurrentScroll();
            this.updateCfrTime(updateParams);
          }
        }
      }
    },
    unBindDrag() {
      const zr = this.chart.getZr();
      zr.off('mousemove');
      zr.off('mouseup');
      window.removeEventListener('mousemove', this.mouseMove);
      window.removeEventListener('mouseup', this.mouseUp);
    },
    // #endregion

    // #region 公共方法

    setDayWidth() {
      const { view } = this.$refs;
      const { dayList, windowDaySpan, percent } = this;
      const dayListLength = dayList.length;
      const length = dayListLength > windowDaySpan + 1 ? windowDaySpan + 1 : dayListLength;
      const dayWidth = (view.clientWidth - 80 * percent) / length;
      this.$set(this, 'dayWidth', dayWidth);
      this.$set(this, 'percent', view.clientHeight / 676);
    },
    /**
     * @description: 获取状态图标
     * @param {String} state 类型
     * @param {Boolean} isOwner 是否主持人
     * @return {Null}
     */
    getIcon(state, isOwner) {
      if (isEmpty(state)) {
        return '';
      }
      if (state === '已提交') {
        return require('../../../assets/image/board/success.svg');
      } if (state === '撮合失败') {
        return require('../../../assets/image/board/warning.svg');
      } if (isOwner) {
        return require('../../../assets/image/board/ring-white.svg');
      }
      return require('../../../assets/image/board/ring-blue.svg');
    },
    /**
     * @description: 获取字符串字节长度
     * @param {String} str 字符串
     * @return {Number} 长度
     */
    getLength(str) {
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
     * @description: 关闭抽屉时，保存会议主题
     * @param {Object} params 事件参数
     * @param {String} params._id 会议id
     * @param {String} params.cfrTime 抽象时间
     * @return {Null}
     */
    updateCfrTime(params) {
      this.loading = true;
      const { _id } = this.spaceBoard;
      this.$store.dispatch('matchSubmit/addOrUpdate', params)
        .then((res) => {
          if (res.code === 0) {
            this.$emit('getSubmitList', _id);
          }
        }).catch((resp) => {
          this.$message.error(resp.message);
          this.$emit('getSubmitList', _id);
        });
    },
    /**
     * @description: 获j禁用时段
     * @return {*}
     */
    getDisabledTimeList() {
      const { dayList, timeRange } = this;
      const timeList = [];
      const { startTime: baseStartTime, endTime: baseEndTime } = timeRange;
      const baseDate = moment().format('YYYY-MM-DD');
      dayList.forEach((day) => {
        if (moment(day).isBefore(baseDate)) {
          timeList.push({
            date: day,
            startTime: baseStartTime,
            endTime: baseEndTime,
          });
        }
        if (moment(day).isSame(baseDate, 'day')) {
          timeList.push({
            date: day,
            startTime: baseStartTime,
            endTime: moment().format('HH:mm'),
          });
        }
      });
      const result = [];
      timeList.forEach((time) => {
        const { date, startTime, endTime } = time;
        const contentInfo = [
          this.getDayIndex(date),
          JSON.stringify([]),
          moment(`${baseDate} ${startTime}`).format('YYYY-MM-DD HH:mm'),
          `${baseDate} ${endTime}`,
          1,
        ];
        result.push(contentInfo);
      });
      return result;
    },
    /**
     * @description: 设置当前选中会议
     * @param {*} submitList
     * @param {*} _id
     * @return {*}
     */
    setActiveCfr(submitList, _id) {
      submitList.map((item) => {
        if (item._id === _id) {
          item.isActive = true;
          this.$set(this, 'activeSubmit', item);
        } else {
          item.isActive = false;
        }
      });
      this.$set(this, 'conferenceData', this.formatCfrData(submitList));
      this.chart.setOption({
        series: [{
          data: this.conferenceData,
        }],
      });
    },
    /**
     * @description: 清除当前选中会议
     * @return {*}
     */
    clearActiveCfr() {
      const { submitList } = this;
      this.activeSubmit = {};
      this.$set(this, 'conferenceData', this.formatCfrData(submitList));
      this.chart.setOption({
        series: [{
          data: this.conferenceData,
        }],
      });
    },
    /**
     * @description: 报错滚动状态
     * @return {*}
     */
    saveCurrentScroll() {
      const { chart } = this;
      const currentDataZoomYStart = chart.getOption().dataZoom[0].start;
      const currentDataZoomYEnd = chart.getOption().dataZoom[0].end;
      const currentDataZoomXStart = chart.getOption().dataZoom[2].start;
      const currentDataZoomXEnd = chart.getOption().dataZoom[2].end;
      this.$set(this, 'currentDataZoomYStart', currentDataZoomYStart);
      this.$set(this, 'currentDataZoomYEnd', currentDataZoomYEnd);
      this.$set(this, 'currentDataZoomXStart', currentDataZoomXStart);
      this.$set(this, 'currentDataZoomXEnd', currentDataZoomXEnd);
    },
    /**
     * @description: 清空滚动状态
     * @return {*}
     */
    resetCurrentScroll() {
      this.$set(this, 'currentDataZoomYStart', 0);
      this.$set(this, 'currentDataZoomYEnd', 0);
      this.$set(this, 'currentDataZoomXStart', 0);
      this.$set(this, 'currentDataZoomXEnd', 0);
    },
    // #endregion
  },
};
</script>

<style lang="scss">
.board {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  font-family: DINAlternate, DINAlternate;
  // background-color: rgb(225, 223, 223);
  #view {
    width: 100%;
    height: 100%;
  }
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: #E2E3EE;
}
.moving {
  position: absolute;
  border: 1px solid #FFFFFF;
  background-color: #F2F4FF;
  pointer-events: none;
  border-radius: 8px;
  box-shadow: 0px 2px 8px 0px #868DD2;
  z-index: 10000000;
  overflow: hidden;
  .title {
    font-size: 12px;
    color: #000000;
    margin-left: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .content {
    display: flex;
    color: #8E92B3;
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

  &.is-owner {
    background-color: #6373FF;
    .title {
      color: #FFFFFF;
    }
    .content {
      color: #C0C7FF;
    }
  }
  &.from-tooltip {
    .title {
      line-height: 28px;
    }
  }
}
</style>
