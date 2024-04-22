<template>
  <div class="scroll" ref="scroll">
    <div id="view" ref="view"></div>
    <div class="btnList" ref="scrollBtn">
      <button v-for="(item, index) in dayList" :key="index" @click="change(item, index)">
        {{`${item.year}-${moment(item.date).format('MM-DD')}`}}
      </button>
    </div>
  </div>
</template>
<script>
import * as echarts from 'echarts';
import moment from 'moment'
export default {
  name: 'echarts_scroll',
  data() {
    return {
      myChart: null,
      dayList:[],
      dataByYear: [],
      activeYear: '2023', // all/年份
      data:[{
        date: "2023-01-05",
        type: "本年度",
        month: "1 月",
        value: 42
      },
      {
        date: "2023-02-03",
        type: "本年度",
        month: "2 月",
        value: 67
      },
      {
        date: "2023-03-12",
        type: "本年度",
        month: "3 月",
        value: 38
      },
      {
        date: "2023-04-20",
        type: "本年度",
        month: "4 月",
        value: 55
      },
      {
        date: "2023-05-05",
        type: "本年度",
        month: "5 月",
        value: 76
      },
      {
        date: "2023-06-10",
        type: "本年度",
        month: "6 月",
        value: 23
      },
      {
        date: "2023-07-15",
        type: "本年度",
        month: "7 月",
        value: 88
      },
      {
        date: "2023-08-20",
        type: "本年度",
        month: "8 月",
        value: 44
      },
      {
        date: "2023-09-05",
        type: "本年度",
        month: "9 月",
        value: 33
      },
      {
        date: "2023-10-10",
        type: "本年度",
        month: "10 月",
        value: 66
      },
      {
        date: "2023-11-15",
        type: "本年度",
        month: "11 月",
        value: 55
      },
      {
        date: "2023-12-20",
        type: "本年度",
        month: "12 月",
        value: 99
      },
      {
        date: "2022-05-06",
        type: "上一年",
        month: "5 月",
        value: 56
      },
      {
        date: "2022-06-07",
        type: "上一年",
        month: "6 月",
        value: 85
      },
      {
        date: "2022-08-09",
        type: "上一年",
        month: "7 月",
        value: 45
      },
      {
        date: "2022-08-20",
        type: "上一年",
        month: "8 月",
        value: 28
      },],
      monthSpan: 3, // 若echarts固定展示范围，则可通过配置此项进行范围控制， 若当前选择6月，配置为3 则展示3-9  配置为2 则展示4-8
    }
  },
  methods: {
    moment,
    init() {
      this.myChart = echarts.init(this.$refs.view)
      this.remakeData();
      this.myChart.setOption(this.makeOption())
      const monthOfFirstDay = parseInt(moment(this.dayList[0].date).format('MM'))
      this.getStartAndEndMonthIndex(monthOfFirstDay);// 传入当前想展示的月份
    },
    makeOption() {
      const { dataByYear } = this;
      // 根据dataByYear 生成series 暂时默认展示所有数据
      const series = [];
      for(const key in dataByYear) {
        series.push({
          type: 'line',
          data: dataByYear[key],
          name: key,
        })
      }
      
      const option = {
        xAxis: {
          type: 'time',
          axisLabel: { // 可自定义x轴展示字段
            formatter: function (value) {
              return moment(value).format('MM-DD');
            }
          }
        },
        yAxis: {
          type: 'value'
        },
        legend: {
          data: Object.keys(dataByYear)
        },
        series,
        dataZoom: [{
          type: 'slider',
          show: false,
          filterMode: 'none'
        },{
          type: 'inside',
          zoomLock: true,
          filterMode: 'none'
        }]
      }
      return option;
    },
    // 将日期转化为本年度
    formatDate(date) {
      return `${moment().format('YYYY')}-${moment(date).format('MM-DD')}`;
    },
    getYear(date){
      return moment(date).format('YYYY')
    },
    remakeData() {
      const {data} = this;
      const dataSort = data.sort((a,b) => {
        return moment(this.formatDate(a.date)).valueOf()-moment(this.formatDate(b.date)).valueOf()
      })
      // 将data中数据按照date的月日排序

      // 遍历Data数据，根据年度分别按照[date,value]格式放入thisYearData和lastYearData中，并将所有date格式化成今年日期存入dayList中

      const yearMap = new Map();
      const dateMap = new Map();
      dataSort.forEach(item => {
        const {date,value} = item;
        const dateStr = this.formatDate(date)
        const year = this.getYear(date)
        // 根据年度分别压入更新日期后数据
        if(yearMap.has(year)){
          yearMap.set(year,yearMap.get(year).concat([[dateStr, value]]))
          dateMap.set(year, dateMap.get(year).concat([{date:dateStr, year}]))
        } else {
          yearMap.set(year,[[dateStr, value]])
          dateMap.set(year,[{date:dateStr, year}])
        }
      })
      const dataByYear = Object.fromEntries(yearMap);
      const dateByYear = Object.fromEntries(dateMap);
      const {activeYear} = this;
      let dayList = [];
      // 根据选中年份，获取对应的dayList
      if(activeYear === 'all') {
        for(const key in dataByYear) {
          dayList = dayList.concat(dateByYear[key])
        }
      } else {
        dayList = dateByYear[activeYear]
      }
      dayList = dayList.sort((a,b) => {
        return moment(a.date).valueOf()-moment(b.date).valueOf()
      })
      
      this.$set(this, 'dataByYear', dataByYear)
      this.$set(this, 'dayList', dayList)
    },
    change(item,index) {
      const {monthSpan} = this;
      let start,end;
      // 点击日期放在中间（数据中间）（若日期密度不确定则可能出现当前选中数据出现在非中间的其他位置）
      start = index - monthSpan < 0 ? 0 : (index - monthSpan);
      end = start + 2 * monthSpan;
      if(end > this.dayList.length) {
        end = this.dayList.length;
        start = end - 2 * monthSpan;
      }

      // 点击日期放在中间（月份中间）
      // 根据全部数据获取月份，将当前月份至于中间，展示前后三个月数据（若日期密度不确定，则可能导致charts图一边密一边稀疏的情况）
      const month = moment(item).format('MM');
      // 获取当前月份的索引
      const indexMonth = this.dayList.findIndex(item => moment(item.date).format('MM') === month);
      let startMonthIndex = this.dayList.findIndex(item => parseInt(moment(item.date).format('MM')) === parseInt(month) - 3)
      if(startMonthIndex<0) startMonthIndex = 0;
      // 获取当前月份的索引
      const startMonth = moment(this.dayList[start].date).format('MM');
      let endMonth = parseInt(startMonth) + 2 * monthSpan;
      if(endMonth > 12) {
        endMonth = 12;
      }
      if(indexMonth !== -1) {
        start = startMonthIndex < 0 ? 0 : startMonthIndex;
        end = this.dayList.findIndex(item => parseInt(moment(item.date).format('MM')) === endMonth);
      }
    
      if(endMonth >= 12) {
        end = this.dayList.length-1;
        start = this.dayList.findIndex(item => parseInt(moment(item.date).format('MM')) === parseInt(endMonth) - 2 * monthSpan);
      }
      // 更新echarts图表的dataZoom
      this.myChart.setOption({
        dataZoom: [{
          startValue: this.dayList[start].date,
          endValue: this.dayList[end].date,
        }]
      })
      this.addMarkLine(index)
    },
    /**
     * @description: 根据传入的月份获取当前月份的索引，通过change函数完成dataZoom的更新
     * @param {*} month
     * @return {*}
     */
    getStartAndEndMonthIndex(month){
      const index = this.dayList.findIndex(item => {
        return parseInt(moment(item.date).format('MM')) === month
      });
      this.change(this.dayList[index], index)
    },
    // 动态添加分割线的函数
    addMarkLine(xAxisIndex) {
      const date = this.dayList[xAxisIndex].date;
      const dataList = this.getDataInDate(date);
      const markPointData = dataList.map(item => {
        return {
          xAxis:this.formatDate(item.date), 
          yAxis:item.value,
          value: item.value, 
        }
      })
      // 更新图表配置
      this.myChart.setOption({
          series: [{
              markLine: {
                  symbol: 'none', // 去掉箭头
                  data: [{
                      xAxis:  date, // 选中的 x 轴坐标索引
                  }],
                  label: {
                    show: true, // 分割线是否展示对应日期   
                    position: 'start', // 标签位置  start/end
                    formatter: function(params) {
                      return `${moment(params.data.coord[0]).format('MM-DD')}`
                    }
                  },
                  lineStyle: {
                    // color: '#868DD2', // 自定义分割线颜色
                  }
              },
              markPoint: {
                data: markPointData,
                itemStyle: {
                  // color: '#868DD2', // 自定义标记点颜色
                }
              }
          }]
      });
    },
    getDataInDate(date){
      return this.data.filter(item => moment(item.date).format('MM-DD') === moment(date).format('MM-DD'))
    },
  },
  mounted() {
    this.init()
  }
}
</script>
<style lang="less">
.scroll {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: #f5f5f5;

  #view {
    width: 100%;
    height: 80%;
  }
  .btnList {
    overflow-x: auto;
    white-space: nowrap;
    width: 100%;
    // margin-left: 10%;
    // button{
      // width: 12.5%;
    // }
  }
}
</style>