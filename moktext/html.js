/*--
	HTML模块化
	-site http://mokjs.com/moktext/
*/
var fs = require('fs'),
	util = require('../common/util'),
	reg_mark = /^\s*<include.+?src=['"](.*?)['"].*?>/,
	//reg_preview = /^\s*<!--\s*preview.+?css=['"](.*?)['"].*?>/,
	reg_echo = /{{[\D\d]*?}}/g,
	reg_mokdata = /<mokdata\s+name=['"](.*?)['"].*?>([\D\d]*?)<\/mokdata>/g,
	charset, //文件编码，默认utf8
	glb_data, //配置里的全局数据
	err_log = [],
	prj_path,

	combining,
	file_tree,
	tree_deep,
	contents;

var parseJson = function (jsonString) {
	try {
		return (new Function('return '+jsonString))();
	} catch (ex) {
		console.log('MOKTEXT-201: Parse JSON error.\n'+jsonString);
		return null;
	}
};
var ctrl_char = {'\r':'\\r', '\n':'\\n', "'":"\\'", '\\':'\\\\'};
var execJS = function (code, data) {
	try {
		return (new Function('$data', code.replace(/\[\[([\D\d]*?)\]\]/g,
			function ($0, $1) {
				return "'"+$1.replace(/[\n\r'\\]/g, function (m) {
					return ctrl_char[m];
				})+"'";
			})))(data);
	} catch (ex) {
		console.log('MOKTEXT-202: Template syntax error.\n{{'+code+'}}\n'+ex);
		return false;
	}
};

//初始化合并
function initCombine() {
	file_tree = [];
	tree_deep = 0;
	contents = [];
	combining = {};
}
//合并
function combine(file, data, prefile) {
	prefile && (file = util.resolveHCPath(prefile, file));
	if (!fs.existsSync(prj_path+file) || !fs.statSync(prj_path+file).isFile()) {
		err_log.push('MOKTEXT-005: '+(prefile ? prefile+' 引用的文件 ' : '文件 ')+
			file+' 不存在！');
		return;
	}
	if (combining[file]) {return} //处理循环依赖
	combining[file] = true;
	file_tree.push(util.repeat('|   ', tree_deep)+'|...'+file);
	tree_deep++;

	data || (data = {});
	if (glb_data) {
		for (var k in glb_data) {
			data.hasOwnProperty(k) || (data[k] = glb_data[k]);
		}
	}
	var mokdata = {};
	var lines = fs.readFileSync(prj_path+file, charset).replace(reg_echo,
		function (m) {
			//写入data
			m = m.slice(2, -2).trim();
			if (/^[\$\w]*$/.test(m)) {
				return data[m] || (data.hasOwnProperty(m) ? String(data[m]) : '');
			}
			m = execJS(m, data);
			return m || (m===0 ? '0' : '');
		}).replace(reg_mokdata, function (m, name, value) {
			//提取mokdata
			if (name.indexOf('.')<1) {return ''}
			name = name.trim().split('.');
			(mokdata[name[0]] || (mokdata[name[0]] = {}))[name[1]] = value;
			return '';
		}).replace(/\r/g, '').split('\n');
	data = null;
	var i = 0, len = lines.length,
		line, inc_file;
	for (; i < len; i++) {
		line = lines[i];
		inc_file = line.match(reg_mark);
		if (inc_file) {
			inc_file = inc_file[1].trim();
			if (inc_file) {
				data = line.indexOf('data=')>0 &&
					line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1);
				if (data) {
					data = parseJson(data);
				} else {
					data = line.match(/data=['"](.*?)['"]/);
					data && (data = mokdata[data[1].trim()]);
				}
				combine(inc_file, data, file);
			}
		} else {
			contents.push(line);
		}
	}

	mokdata = null;
	tree_deep--;
	combining[file] = false;
}

//输出HTML
exports.output = function (filename, prj_conf, response) {
	prj_path = prj_conf.path;
	//filename = filename.slice(1);
	var file = prj_path+filename;
	if (fs.existsSync(file) && fs.statSync(file).isFile()) {
		charset = prj_conf.charset;
		glb_data = prj_conf.data;
		err_log = [];
		initCombine();
		glb_data.__file = filename;
		combine(filename);
		glb_data.__file = '';
		response.writeHead(200, {
			'Content-Type': 'text/html', 
			'Cache-Control': 'max-age=0'
		});
		response.write(contents.join('\r\n'));
		err_log.length && response.write('<script type="text/javascript">alert("'+
			err_log.join('\\n')+'");</script>');
		response.end('<!-- file tree:\r\n'+file_tree.join('\r\n')+
			'\r\n-By MOKTEXT. -->');
		err_log = contents = combining = null;
	} else {
		response.writeHead(200, {'Content-Type':'text/plain'});
		response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
	}
};

//预览某个模块
exports.viewModule = function (filename, prj_conf, response) {
	prj_path = prj_conf.path;
	filename[0]==='/' && (filename = filename.slice(1));
	var file = prj_path+filename;
	if (fs.existsSync(file) && fs.statSync(file).isFile()) {
		charset = prj_conf.charset;
		glb_data = prj_conf.data;
		err_log = [];
		initCombine();

		contents.push('<!DOCTYPE html><html><head>'+
			'<meta http-equiv="Content-Type" content="text/html;charset='+
			(charset[0].toLowerCase()==='u' ? 'utf-8' : charset)+
			'"><title>预览模块[ '+filename+' ]</title></head><body>');
		glb_data.__preview = true;
		glb_data.__file = filename;
		combine(filename);
		glb_data.__preview = false;
		glb_data.__file = '';
		contents.push('</body></html>\r\n');

		response.writeHead(200, {
			'Content-Type': 'text/html',
			'Cache-Control': 'max-age=0'
		});
		response.write(contents.join('\r\n'));
		err_log.length && response.write('<script type="text/javascript">alert("'+
			err_log.join('\\n')+'");</script>');
		response.end('<!-- file tree:\r\n'+file_tree.join('\r\n')+'\r\n-->');
		err_log = contents = combining = null;
	} else {
		response.writeHead(200, {'Content-Type':'text/plain'});
		response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
	}
};

//构建项目。argv 构建命令参数，例如 {_prj:'blog', _cmd:'build'}
exports.build = function (argv, prj_conf, response) {
	prj_path = prj_conf.path;
	prj_path.slice(-1)==='/' || (prj_path += '/');
	charset = prj_conf.charset || 'utf8';
	err_log = [];
	glb_data = prj_conf.build_data || {};
	var data = prj_conf.data;
	if (data) {
		for (var k in data) {
			glb_data.hasOwnProperty(k) || (glb_data[k] = data[k]);
		}
	}

	var build_path = prj_conf.build_path,
		start_time = Date.now();
	build_path.slice(-1)==='/' || (build_path += '/');

	//从命令行来
	response || (response = util.fakeResponse);
	response.writeHead(200, {
		'Content-Type': 'text/html',
		'Cache-Control': 'max-age=0'
	});
	response._fake_ || response.write(global.HEAD_HTML
		.replace('{{title}}', '构建HTML文件')+
		'<script>'+fs.readFileSync('mok-js/br-build.js', 'utf8')+'</script>');

	fs.existsSync(build_path) || fs.mkdirSync(build_path); //不能清空文件夹
	
	var k = require.resolve(require('path').resolve(prj_path+'build-list'));
	var build_list = require(k);
	require.cache[k] = null; //不缓存构建列表
	var main_files = [], main_len,
		main_file, fc, fd, file_md5; //console.log(main_files)
	response.write(''); //让控制台输出一个空行
	for (k in build_list) {
		build_list.hasOwnProperty(k) && main_files.push(k); //计算总长度
	}
	for (k = 0, main_len = main_files.length; k < main_len; k++) {
		main_file = main_files[k];
		response.write('<br />=== 正在合并文件 '+main_file+' 　--- '+(main_len - k));
		initCombine();
		glb_data.__file = main_file;
		combine(main_file, false);
		glb_data.__file = '';
		fc = contents.join('\r\n')+
			'<!-- file tree:\r\n'+file_tree.join('\r\n')+'\r\n- By MOKTEXT. -->';
		
		build_list[main_file]===1 || (main_file = build_list[main_file]);
		util.mkdir(build_path, main_file);
		fd = fs.openSync(build_path+main_file, 'w', '0666');
		fs.writeSync(fd, fc, 0, charset);
		fs.closeSync(fd);
	}

	contents = combining = null;
	if (err_log.length) {
		response.write('<br />'); //来个换行
		for (k = 0; k < err_log.length; k++) {
			response.write('<br />'+err_log[k]);
		}
		response.end('<br/><br />====== 囧，构建失败了 TAT...<br/></body></html>');
		err_log = null;
		return;
	}
	
	response.write('<br/><br />====== 构建成功！<br/>====== 总共用时：'+
		(Date.now()-start_time)/1000 +' s.'+util.buildTime());
	response.end('<br/><br /></body></html>');
};
