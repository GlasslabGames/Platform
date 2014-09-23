function genData(skillLevel) {
  
  var telemetryData = {}
  
  switch(skillLevel) {
      case 'low':
          // return telem data to send to make a low-performing user
          break;
      case 'high':
          // return telem data to send to make a high-performing user
          break;
      default:
          break
  }
  
  return telemetryData;

}


module.exports = {

  gameId: 'AA-1',
  
  reports: ['achievements', 'sowo'],
  
  genData: genData

}