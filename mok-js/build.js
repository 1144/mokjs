/*--
	构建JS项目（合并压缩）
	-p obj argv 构建命令参数，例如 {_prj:'blog', _cmd:'build', v:'2'}
	-p obj prj_conf 项目配置
	-p Response response http响应对象
*/
exports.build = function (argv, prj_conf, response) {
	var boot_js = prj_conf.boot_js,
		version = argv.v,
		cmd_spec = prj_conf.modular_spec==='CMD',
		build_data = prj_conf.build_data || {},
		charset = prj_conf.charset,
		comp_cmd = require('../__config').compress_cmd,
		util = require('../common/util'),
		sfs = util.getSfs(charset),

		prj_path = prj_conf.path,
		build_path = prj_conf.build_path,
		prj_path_len = prj_path.length,
		path_main = build_path+'main/',
		path_min = build_path+'min/',
		path_updated = build_path+'updated/',
		path_tag, //待上线的tag版本，放在updated文件夹下

		abc_newverstr, abc_a = '', abc_c = '',
		abc_name2ver = {}, //存放所有的文件名及对应的版本号
		abc_allname = [], //存放所有的文件名，用于输出boot_js时排序所有文件
		abc_isnew = {}, //存放新增加的文件，以文件名为key，值为true
		all_files = {}, //存放文件内容，以文件名为key，值为文件内容

		fs = require('fs'),
		child_process = require('child_process'),
		crypto = require('crypto'),

		err_log = [], //收集编译错误信息
		br_mok = fs.readFileSync('mok-js/br-mok-'+
			(cmd_spec ? 'CMD.js' : 'Modules.js'), 'utf8'),
		//块注释，要先移除块注释
		reg_data_key = /\/\*{{([\D\d]+?)}}\*\//g,
		reg_comment = /\/\*[\D\d]*?\*\//g,
		reg_define = /^[\t ]*define[\t ]*\(.+$/m,
		file_req = {}, //文件名作为key，值是该文件依赖的模块数组
		start_time = Date.now(), //当前时间

		main_len, main_count = 0,
		calcing = {}, //记录正在遍历的，防止循环依赖
		depended = {},
		depended_list = [];

	//处理uglifyjs压缩命令
	comp_cmd = comp_cmd.replace('{filename}', path_main+';')
		.replace('{filename}', path_min+';');

	//创建构建目录
	function mkdir() {
		fs.existsSync(build_path) || fs.mkdirSync(build_path);
		fs.existsSync(path_main) || fs.mkdirSync(path_main);
		fs.existsSync(path_min) ? util.cleardir(path_min) : fs.mkdirSync(path_min);
		fs.existsSync(path_updated) || fs.mkdirSync(path_updated);
	}
	//初始化：读取版本信息
	function init() {
		if (prj_conf.format_tag) {
			var ret = prj_conf.format_tag(version);
			abc_newverstr = ret.version;
			path_tag = path_updated+ret.folder_name+'/';
		} else if (version) {
			abc_newverstr = version+'/';
			path_tag = path_updated+version+'/';
		} else {	//没有版本
			boot_js = path_tag = false;
			return;
		}
		fs.existsSync(path_tag) ? util.cleardir(path_tag) : fs.mkdirSync(path_tag);

		if (boot_js) {	//判断boot_js是否真的存在
			fs.existsSync(prj_path+boot_js) || (boot_js = false);
		}
		//解析当前版本号
		if (boot_js) {
			var vers = fs.readFileSync(prj_path+boot_js, charset).split('<version>'),
				len, vs, quot;
			if (vers.length<2) {return}
			abc_a = vers[0];
			vers = vers[1].split('</version>');
			abc_c = vers[1];
			vers = vers[0].split('\n');
			for (i = 0, len = vers.length; i < len; i++) {
				quot = vers[i].match(/^[\t ]*(["'])/);
				if (quot) {
					vs = vers[i].split(/"|'/);
					abc_name2ver[vs[1]+'.js'] = vs[3];
				}
			}
		}
	}
	//分析依赖：采用CMD规范
	function parseCMDRequire(file) { //console.log(file);
		var file_content = [];
		file_content.push('\r\n/* ===== '+file+' ===== */');

		var lines = all_files[file].replace(reg_define, function (mark) {
				return mark.replace(/define[\t ]*\(/, ';(mok["'+
					util.getModuleAbbr(file.slice(0, -3))+'"]=');
			}).split('\n'),
			i = 0, len = lines.length, line, req_ms,
			depend_ms = [];
		for (; i < len; i++) {
			line = lines[i];
			if (line.indexOf('require')<0) { //90%以上无require吧
				file_content.push(line);
			} else {
				req_ms = util.parseRequire(line, file);
				file_content.push(req_ms[0]);
				req_ms = req_ms[1]; //复用req_ms
				while (req_ms.length) {
					line = req_ms.shift()+'.js'; //复用line
					depend_ms.push(line);
					all_files[line] || err_log.push('MOKJS-005: '+file+' 依赖的模块 '+
						line.slice(0, -3)+' 不存在！<br/>line '+(i + 1)+': '+lines[i]);
				}
			}
		}
		depend_ms.length && (file_req[file] = depend_ms);

		all_files[file] = file_content.join('\r\n');
	}
	//分析依赖：采用CommonJS Modules规范
	function parseRequire(file) {
		var file_content = [];
		file_content.push('\r\n/* ===== '+file+' ===== */\r\n'+
			'mok["'+ util.getModuleAbbr(file.slice(0, -3)) +
			'"]=function(require, module, exports){');

		var lines = all_files[file].split('\n'),
			i = 0, len = lines.length, line, req_ms,
			depend_ms = [];
		for (; i < len; i++) {
			line = lines[i];
			if (line.indexOf('require')<0) { //90%以上无require吧
				file_content.push(line);
			} else {
				req_ms = util.parseRequire(line, file); //console.log(req_ms)
				file_content.push(req_ms[0]);
				req_ms = req_ms[1]; //复用req_ms
				while (req_ms.length) {
					line = req_ms.shift()+'.js'; //复用line
					depend_ms.push(line);
					all_files[line] || err_log.push('MOKJS-005: '+file+' 依赖的模块 '+
						line.slice(0, -3)+' 不存在！<br/>line '+(i + 1)+': '+lines[i]);
				}
			}
		}
		depend_ms.length && (file_req[file] = depend_ms);

		file_content.push('};\r\n');
		all_files[file] = file_content.join('\r\n');
	}
	//读取所有文件
	function readAllFiles(path, files) {
		fs.readdirSync(path).forEach(function (filename) {
			var file = path+'/'+filename;
			//console.log(file);
			if (filename.slice(-3)==='.js') {
				files[file.slice(prj_path_len)] = fs.readFileSync(file, charset)
					.replace(reg_data_key, function (input, $1) {
						$1 = $1.trim();
						return build_data[$1] || (/^[\$\w]*$/.test($1) ? '' : $1);
					}).replace(reg_comment, '').replace(/^\s+/, '').replace(/\r/g, '');
			} else if (filename[0]!=='.' && fs.statSync(file).isDirectory()) {
				//排除.svn，.github之类的文件夹
				readAllFiles(file, files);
			}
		});
	}
	//解析require语法
	function parseReq() {
		for (var i in all_files) {
			cmd_spec ? parseCMDRequire(i) : parseRequire(i);
		}
	}
	function calcDependList(file) {
		calcing[file] = true;
		var reqs = file_req[file];
		if (reqs) {
			for (var i = 0, len = reqs.length, fi; i < len; i++) {
				fi = reqs[i];
				if (depended[fi] || calcing[fi]) {
					continue;
				}
				calcDependList(fi);
			}
		}
		depended_list.push(file);
		depended[file] = true;
	}
	//更新启动文件里的JS文件版本信息
	function updateAbcFile() {
		var content = '<version> */';
		abc_allname.sort().forEach(function (name) {
			if (abc_name2ver[name]) {
				content += '\r\n"'+name.slice(0, -3)+'": "'+abc_name2ver[name]+'",';
				if (abc_isnew[name]) {
					content += ' /*new*/';
					name.indexOf('/')>0 && util.mkdir(path_tag, name);
				} else if (abc_name2ver[name].indexOf(abc_newverstr)===0) {
					content += ' /*u*/';
					name.indexOf('/')>0 && util.mkdir(path_tag, name);
				} else {
					delete abc_name2ver[name];
					return;
				}
				delete abc_name2ver[name];
				//复制有变化的文件
				sfs.copy(path_min+name, path_tag+name);
			}
		});
		var deleted = [], k;
		for (k in abc_name2ver) {
			content += '\r\n/*"'+k.slice(0, -3)+'": "'+abc_name2ver[k]+'", del*/';
			deleted.push(k);
		}
		content = abc_a+content+'\r\n/* </version>'+abc_c;
		sfs.write(path_tag+boot_js, content);
		sfs.write(path_min+boot_js, content); //复制boot_js文件到min目录下
		//复制abc.js文件到打包项目的目录下，命名为update-abc.js，
		//提交SVN时先删除已有的abc.js，
		//再把update-abc.js重命名为abc.js，即实现更新abc.js
		sfs.write(prj_path+'updated-'+boot_js, content);
		
		deleted.length &&
			response.write('<br/>MOKJS-051: 有main文件被删除了：'+deleted.join(', '));
	}
	//构建完成
	function buildDone() {
		boot_js && err_log.length===0 && updateAbcFile();
		if (err_log.length) {
			for (var ei = 0; ei < err_log.length; ei++) {
				response.write('<br/><br/>'+err_log[ei]);
			}
			response.end('<br/><br/>囧，合并压缩失败了 TAT...<br/></body></html>');
			return;
		}
		response.end('<br/><br/>=== 合并压缩成功！===<br/>总共用时：'+
			(Date.now()-start_time)/1000 +' s.'+util.buildTime()+
			'<br/><br/></body></html>');
		prj_conf.__hasbuilt = true;
	}
	//压缩文件
	function compressFile(file) {
		child_process.exec(comp_cmd.replace(/;/g, file), function (err) {
			if (err) {
				err_log.push('<br/><br/>MOKJS-006: 压缩出错，文件：'+path_main+file+
					'<br/>错误信息：'+err.toString());
				return;
			}
			var fc = fs.readFileSync(path_min+file, charset);
			if (boot_js) {
				//检查文件是否有修改
				var file_md5 = '|'+crypto.createHash('md5').update(fc).
					digest('hex').slice(0, 8);
				if (abc_name2ver[file] && abc_name2ver[file].indexOf(file_md5)>0) {
					//文件未更改
				} else {
					abc_name2ver[file] || (abc_isnew[file] = true);
					abc_name2ver[file] = abc_newverstr+file_md5;
				}
			} else if (path_tag) {
				sfs.write(path_tag+file, fc);
			}
			if (++main_count===main_len) {	//这才算整个打包过程完成哟
				buildDone();
			}
		});
	}
	//读取main下的所有入口文件名，遇到子目录则在构建目录里创建相应的子目录
	function readMainFiles(path, files) {
		fs.readdirSync(path).forEach(function (filename) {
			var file = path+'/'+filename;
			if (filename.slice(-3)==='.js') {
				files.push(file.slice(prj_path_len + 5)); //把“main/”也去掉
			} else if (filename[0]!=='.' && fs.statSync(file).isDirectory()) {
				//排除.svn，.github之类的文件夹
				readMainFiles(file, files);
				//在构建目录的main和min里创建对应的目录
				file = file.slice(prj_path_len + 5)+'/';
				util.mkdir(path_main, file);
				util.mkdir(path_min, file);
				boot_js || util.mkdir(path_tag, file);
			}
		});
	}
	//合并和压缩
	function combineAndCompress() {
		response.write('<br/>');
		var common_js = prj_conf.common_js,
			use_common = !!common_js,
			commoned,
			commoned_list;
		if (use_common) {
			calcDependList('main/'+common_js);
			commoned = depended;
			commoned_list = depended_list;
		}

		var main_files = [];
		readMainFiles(prj_path+'main', main_files);
		main_len = main_files.length;
		
		var i = 0, j, main_file;
		for (; i < main_len; i++) {
			main_file = main_files[i];
			response.write('<br/>=== 正在合并和压缩文件 '+main_file+
				' 　--- '+(main_len - i));
			main_len-i===1 && response.write('<br/>正在努力压缩ing ...');
			abc_allname.push(main_file);
			calcing = {};
			depended = {};
			depended_list = [];
			if (use_common) {
				if (main_file===common_js) { //公共文件单独处理
					depended_list = commoned_list;
				} else {
					for (j in commoned) {
						depended[j] = true;
					}
					calcDependList('main/'+main_file);
				}
			} else {
				calcDependList('main/'+main_file);
			}

			//合并文件
			var j = 0, dl = depended_list.length,
				fd = fs.openSync(path_main+main_file, 'w', '0666'),
				position = fs.writeSync(fd, br_mok, 0, charset);
			for (; j < dl; j++) { //必须正序
				position += fs.writeSync(fd, '\r\n'+all_files[depended_list[j]],
					position, charset);
			}
			fs.writeSync(fd, '\r\nrequire("main/'+main_file.slice(0, -3)+'");\r\n',
				position, charset);
			fs.closeSync(fd);
			
			compressFile(main_file);
		}
	}
	
	//开始！
	mkdir();
	init();
	//载入模块简称与全称的映射
	util.loadModuleAbbr('!'); //清除缓存数据
	util.loadModuleAbbr(prj_path);

	response.writeHead(200, {'Content-Type':'text/html'});
	response.write(global.HEAD_HTML.replace('{{title}}', '合并压缩JS文件')+
		'<script>'+fs.readFileSync('mok-js/br-build.js', 'utf8')+'</script>');
	response.write('正在分析文件依赖 ...');
		readAllFiles(prj_path.slice(0, -1), all_files);
		parseReq();
	response.write('<br/>分析完毕。');

	err_log.length ? buildDone() : combineAndCompress();

};
