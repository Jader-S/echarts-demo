<template>
  <div class="scroll" ref="scroll">
    <div id="view" ref="view"></div>
    <div class="btnList" ref="scrollBtn">
      <button v-for="(item, index) in dayList" :key="index" @click="e=>change(e,item, index)">
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
          startValue: this.dataZoomStart,
          endValue: this.dataZoomEnd,
        },{
          type: 'inside',
          startValue: this.dataZoomStart,
          endValue: this.dataZoomEnd,
        }]
      }
      return option;
    },
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
        if(item.type === '本年度') {
          thisYearData.push([dateStr, value]);
        } else {
          lastYearData.push([dateStr, value]);
        }
        
        dayList.push(dateStr);
      })
      this.$set(this, 'lastYearData', lastYearData);
      this.$set(this, 'thisYearData', thisYearData);
      this.$set(this, 'dayList', dayList)
    },
    change(e,item,index) {
      const dom = e.target;
      // 获取点击点中心的坐标
      console.dir(dom)
      // 对应位置
      // 获取dom父元素的滚动值
      // const scrollLeft = dom.parentElement.scrollLeft;

      // const x = dom.offsetLeft - scrollLeft;
      // // 获取滚动容器的宽度
      // const scrollWidth = this.$refs.scrollBtn.offsetWidth;
      // // 获取点击dom的x坐标在宽度中的占比
      // const percent = x / scrollWidth;
      // // 根据占比获取echarts展示的第一个日期和最后一个日期
      // // const activeDay = this.dayList[index];
      // const start = index-(Math.floor(percent * 7));
      // const end = index-Math.floor(percent * 7) + 7;
      // 点击日期放在中间
      let start = index - 3 < 0 ? 0 : (index - 3);
      let end = start + 7;
      if(end > this.dayList.length) {
        end = this.dayList.length;
        start = end - 7;
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
    // 动态添加分割线的函数
    addMarkLine(xAxisIndex) {
      // 更新图表配置
      console.log("addMarkLine",xAxisIndex)
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