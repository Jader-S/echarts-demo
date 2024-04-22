<template>
  <div class="scroll" ref="scroll">
    <div id="view" ref="view"></div>
    <div class="btnList" ref="scrollBtn">
      <button v-for="(item, index) in dayList" :key="index" @click="change(item, index)">
        {{item}}
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
      thisYearData: [],
      lastYearData: [],
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
        date: "2022-07-09",
        type: "上一年",
        month: "7 月",
        value: 45
      }]
    }
  },
  methods: {
    init() {
      this.myChart = echarts.init(this.$refs.view)
      this.remakeData();
      this.myChart.setOption(this.makeOption())
      this.getStartAndEndMonthIndex(1);// 传入当前想展示的月份
    },
    makeOption() {
      const option = {
        xAxis: {
          type: 'time',
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          data: this.thisYearData,
          type: 'line',
          markLine: {
            data: [],
          }
        },{
          data: this.lastYearData,
          type: 'line'
        }],
        dataZoom: [{
          type: 'slider',
          show: false,
        },{
          type: 'inside',
          zoomLock: true,
        }]
      }
      return option;
    },
    // 将日期转化为本年度
    formatDate(date) {
      return `${moment().format('YYYY')}-${moment(date).format('MM-DD')}`;
    },
    remakeData() {
      const {data} = this;
      const thisYearData = [];
      const lastYearData = [];
      const dayList = [];
      const dataSort = data.sort((a,b) => {
        return moment(this.formatDate(a.date)).valueOf()-moment(this.formatDate(b.date)).valueOf()
      })
      // 将data中数据按照date的月日排序

      // 遍历Data数据，根据年度分别按照[date,value]格式放入thisYearData和lastYearData中，并将所有date格式化成今年日期存入dayList中
      dataSort.forEach(item => {
        const {date,value} = item;
        const dateStr = this.formatDate(date)
        // 根据年度分别压入更新日期后数据
        if(item.type === '本年度') {
          thisYearData.push([dateStr, value]);
        } else {
          lastYearData.push([dateStr, value]);
        }
        // 将有日期的数据压入dayList
        dayList.push(dateStr);
      })
      this.$set(this, 'lastYearData', lastYearData);
      this.$set(this, 'thisYearData', thisYearData);
      this.$set(this, 'dayList', dayList)
    },
    change(item,index) {
      let start,end;
      // 点击日期放在中间（数据中间）（若日期密度不确定则可能出现当前选中数据出现在非中间的其他位置）
      start = index - 3 < 0 ? 0 : (index - 3);
      end = start + 7;
      if(end > this.dayList.length) {
        end = this.dayList.length;
        start = end - 7;
      }

      // 点击日期放在中间（月份中间）
      // 根据全部数据获取月份，将当前月份至于中间，展示前后三个月数据（若日期密度不确定，则可能导致charts图一边密一边稀疏的情况）
      const month = moment(item).format('MM');
      // 获取当前月份的索引
      const indexMonth = this.dayList.findIndex(item => moment(item).format('MM') === month);
      let startMonthIndex = this.dayList.findIndex(item => parseInt(moment(item).format('MM')) === parseInt(month) - 3)
      if(startMonthIndex<0) startMonthIndex = 0;
      // 获取当前月份的索引
      const startMonth = moment(this.dayList[start]).format('MM');
      let endMonth = parseInt(startMonth) + 6;
      if(endMonth > 12) {
        endMonth = 12;
      }
      if(indexMonth !== -1) {
        start = startMonthIndex < 0 ? 0 : startMonthIndex;
        end = this.dayList.findIndex(item => parseInt(moment(item).format('MM')) === endMonth);
      }
    
      if(endMonth >= 12) {
        end = this.dayList.length-1;
        start = this.dayList.findIndex(item => parseInt(moment(item).format('MM')) === parseInt(endMonth) - 7);
      }
      // 更新echarts图表的dataZoom
      this.myChart.setOption({
        dataZoom: [{
          startValue: this.dayList[start],
          endValue: this.dayList[end],
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
      const index = this.dayList.findIndex(item => parseInt(moment(item).format('MM')) === month);
      const monthFormat = moment(this.dayList[index]).format('MM');
      this.change(monthFormat, index)
    },
    // 动态添加分割线的函数
    addMarkLine(xAxisIndex) {
      // 更新图表配置
      this.myChart.setOption({
          series: [{
              markLine: {
                  data: [{
                      xAxis:  this.dayList[xAxisIndex], // 选中的 x 轴坐标索引
                  }]
              }
          }]
      });
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