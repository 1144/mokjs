/*--
	mok模块
	这是示例如何自定义一个mok模块
*/

var n = 0;

//处理url符合某种格式的http请求，在routes配置里调用
//累加指定的数字
exports.count = function(num, response){
	response.writeHead(200, {'Content-Type':'text/plain','Cache-Control':'max-age=0'});
	n += parseInt(num, 10);
	response.end(String(n));
};

//用命令调用模块，在扩展命令里调用
//实现打印项目配置
exports.printPrjConfig = function(argv, prj_conf, response){
	response.write(global.HEAD_HTML.replace('{{title}}', '我是模块demo'));
	response.write('项目名（argv._prj）：' + argv._prj);
	response.write('<br/>正在执行命令（argv._cmd）：' + argv._cmd);
	response.write('<br/>如果有命令参数，请直接访问argv对象的对应属性。');
	response.write('<br/>项目配置：' + JSON.stringify(prj_conf));
	response.end('</body></html>');
};
