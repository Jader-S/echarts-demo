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
// import moment from 'moment'
export default {
  name: 'echarts_scroll',
  data() {
    return {
      myChart: null,
      option: {
        xAxis: {
          type: 'time',
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          data: [
            ['2024-01-01', 120],
            ['2024-01-02', 132],
            ['2024-01-03', 101],
            ['2024-01-04', 134],
            ['2024-01-05', 90],
            ['2024-01-06', 230],
            ['2024-01-07', 210],
            ['2024-01-08', 220],
            ['2024-01-09', 182],
            ['2024-01-10', 191],
            ['2024-01-11', 234],
            ['2024-01-12', 290],
            ['2024-01-13', 330],
            ['2024-01-14', 310],
            ['2024-01-15', 123],
            ['2024-01-16', 220],
            ['2024-01-17', 210],
            ['2024-01-18', 220],
            ['2024-01-19', 182],
            ['2024-01-20', 191],
            ['2024-01-21', 234],
            ['2024-01-22', 290],
            ['2024-01-23', 330],
            ['2024-01-24', 310],
            ['2024-01-25', 123],
            ['2024-01-26', 220],
            ['2024-01-27', 210],
            ['2024-01-28', 220],
          ],
          type: 'line',
          markLine: {
            data: [],
          }
        },{
          data: [
            ['2024-01-01', 220],
            ['2024-01-02', 122],
            ['2024-01-03', 121],
            ['2024-01-04', 124],
            ['2024-01-05', 20],
            ['2024-01-06', 130],
            ['2024-01-07', 220],
            ['2024-01-08', 120],
            ['2024-01-09', 182],
            ['2024-01-10', 291],
            ['2024-01-11', 134],
            ['2024-01-12', 290],
            ['2024-01-13', 320],
            ['2024-01-14', 210],
            ['2024-01-15', 223],
            ['2024-01-16', 210],
            ['2024-01-17', 180],
            ['2024-01-18', 120],
            ['2024-01-19', 122],
            ['2024-01-20', 121],
            ['2024-01-21', 234],
            ['2024-01-22', 250],
            ['2024-01-23', 130],
            ['2024-01-24', 210],
            ['2024-01-25', 163],
            ['2024-01-26', 230],
            ['2024-01-27', 110],
            ['2024-01-28', 160],
          ],
          type: 'line'
        }],
        dataZoom: [{
          type: 'slider',
          startValue: '2024-01-01',
          endValue: '2024-01-08',
        },{
          type: 'inside',
          startValue: '2024-01-01',
          endValue: '2024-01-08',
        }]
      },
      dayList:[]
    }
  },
  methods: {
    init() {
      this.myChart = echarts.init(this.$refs.view)
      this.myChart.setOption(this.option)
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
    initDayList() {
      const dayList = [];
      for(let i = 1; i <= 28; i++) {
        dayList.push(`2024-01-${i < 10 ? '0' + i : i}`);
      }
      this.dayList = dayList;
    }
  },
  mounted() {
    this.initDayList()
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