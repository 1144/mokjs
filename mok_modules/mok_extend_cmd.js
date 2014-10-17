/*--
	扩展命令
	提供扩展命令的特性
*/

//用户未输入任何命令
exports['-'] = function(argv, prj_conf, response){
	//可考虑将这个命令链接到项目文档首页
	response.end(global.HEAD_HTML.replace('{{title}}', '木有输入命令')+
		'<a href="http://mokjs.com/start.html" '+
		'target="_blank">点击这里</a> 查看mokjs的所有内建命令。</body></html>');
};

//定义print命令。在浏览器地址栏输入127.0.0.1/-blog-print将打印出blog项目的配置
exports.print = function(argv, prj_conf, response){
	//通过扩展命令的方式调用mokjs模块
	require('./demo').printPrjConfig(argv, prj_conf, response); //调用demo模块
};
