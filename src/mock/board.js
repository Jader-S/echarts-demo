import Mock from 'mockjs';
import moment from 'moment';

// 生成当前周的日期
const startDate = moment().startOf('week').toDate();
const endDate = moment().endOf('week').toDate();

//根据起止时间生成随机时间
const randomDate = (startDate, endDate) => {
  let date = new Date(+startDate + Math.random() * (endDate - startDate));
  let hour = (0 + Math.random() * (23 - 0)) | 0;
  let minute = (0 + Math.random() * (59 - 0)) | 0;
  let second = (0 + Math.random() * (59 - 0)) | 0;
  date.setHours(hour);
  date.setMinutes(minute);
  date.setSeconds(second);
  return date;
};

// 生成随机开始时间
const randomStartHour = () => {
  let hour = Math.floor((Math.random() * 10) + 9);
  if(hour < 10){
    hour = '0' + hour;
  }
  return hour;
}

// 生成随机结束时间
const randomEndHour = (startHour) => {
  const interval = Math.floor(Math.random() * 2) + 1;
  let hour = +startHour + interval;
  return hour;
}

export const getBoardData =  new Promise (resolve => {
  let testData = [];
  // 数据数量
  const length = 20;
  for (let i = 0; i < length; i++) {
    testData.push(
      Mock.mock({
        id: '@increment',
        title: '主题@id@cword(2, 4)',
        info1: '信息1@cword(2, 4)',
        info2: '信息2@cword(2, 4)',
      })
    );
    testData[i].date = moment(randomDate(startDate, endDate)).format(
      "YYYY-MM-DD"
    );
    const startHour = randomStartHour();
    const endHour = randomEndHour(startHour);
    testData[i].startTime = startHour;
    testData[i].endTime = endHour;
  }
  resolve(testData);
});
