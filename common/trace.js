/*
	把文本加上颜色后输出到控制台 或者 把文本加上颜色控制符
*/
var trace = {
	log: function (msg) {
		console.log(msg);
	},
	ok: function (msg) {
		console.log('\033[1m\033[32m' + msg + '\033[0m');    //green
	},
	warn: function (msg) {
		console.log('\033[1m\033[33m' + msg + '\033[0m');    //yellow
	},
	error: function (msg) {
		console.log('\033[1m\033[31m' + msg + '\033[0m');    //red
	},
	green: function (msg) {
		return '\033[1m\033[32m' + msg + '\033[0m';    //green
	},
	yellow: function (msg) {
		return '\033[1m\033[33m' + msg + '\033[0m';    //yellow
	},
	red: function (msg) {
		return '\033[1m\033[31m' + msg + '\033[0m';    //red
	}
};

module.exports = trace;

//trace.log(1)
//trace.ok(2)
//trace.warn(3)
//trace.error(4)
