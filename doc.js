
var _config = require('./__config');
var project = process.argv[2];
if(!project){
	console.log('��������Ŀ����');
	return;
}
var prjconfig = _config.projects[project];
if(!prjconfig){
	console.log('�����ļ�����Ŀ '+project+' �����ڣ���������ȷ����Ŀ����');
	return;
}

require('./mokdoc/main').main('', prjconfig, false);
