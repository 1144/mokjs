/*--
	自定义命令
	提供自定义命令的特性
*/

//用户未输入任何命令
exports['-'] = function(argv, prj_conf, response){
	//可考虑将这个命令链接到项目文档首页
	response.end(global.HEAD_HTML.replace('{{title}}', '木有输入命令')+
		'<a href="http://mokjs.com/cmds.html" '+
		'target="_blank">点击这里</a> 查看mokjs的所有内建命令。</body></html>');
};

//定义print命令
exports.print = function(argv, prj_conf, response){ //通过命令的方式调用自定义的模块
	require('./usr_modules/demo').printPrjConfig(argv, prj_conf, response); //调用usr模块
};
