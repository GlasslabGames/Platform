module.exports = {

    zfill: zfill,
		tstamp: tstamp
    
}

function zfill(num, size) {
    var s = ''+num;
    while (s.length < size) s = "0" + s;
    return s;
}

function tstamp() {
	var date = (new Date());
	return zfill(date.getDate(),2) + '.' + zfill(date.getMonth()+1,2) +
		'.' + date.getFullYear() + '-' + zfill(date.getHours(),2) + ':' +
		date.getMinutes() + ':' + date.getSeconds()
}