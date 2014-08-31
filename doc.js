
var _config = require('./__config');
var project = process.argv[2];
if(!project){
	console.log('请输入项目名！');
	return;
}
var prjconfig = _config.projects[project];
if(!prjconfig){
	console.log('配置文件里项目 '+project+' 不存在，请输入正确的项目名！');
	return;
}

require('./mokdoc/main').main('', prjconfig, false);
