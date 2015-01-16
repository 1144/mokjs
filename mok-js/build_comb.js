
	//加1，给版本号或文件名
	var addOne = (function () {
		var nums = '0123456789abcdefghijklmnopqrstuvwxyz0', nexts = {};
		for (var j = 0, len = nums.length - 1; j < len; ) {
			nexts[ nums[j] ] = nums[++j];
		}
		return function (value) {
			if (!value) {return '10'} //从'10'开始

			value = value.split('');
			var i = value.length;
			while (i--) {
				if (nexts[value[i]]==='0') {
					value[i] = '0';
				} else {
					value[i] = nexts[value[i]];
					break;
				}
			}
			if (value[0]==='0') {
				value.unshift('1');
			}

			return value.join('');
		};
	})();

	//解析版本控制文件
	function parseVersion(file, charset) {
		var fs = require('fs'), versions = {};
		if (fs.existsSync(file) && fs.statSync(file).isFile()) {
			var vers = fs.readFileSync(file, charset).split('\r\n');
			if (String(vers[0]).indexOf('LAST_VER')>-1) {
				versions.LAST_VER = vers[0].split(':')[1];
			}
			if (String(vers[1]).indexOf('LAST_FILE')>-1) {
				versions.LAST_FILE = vers[1].split(':')[1];
			}
			var i = 2, len = vers.length, ver;
			for (; i < len; i++) {
				ver = vers[i].split('    '); //4个空格
				if (ver.length>3) {
					//文件路径为key
					//值为数组：[编码后的文件名, 2位版本号，8位文件MD5值，文件名]
					versions[ver[3]] = [ver[0].slice(1), ver[1], ver[2], ver[3]];
				}
			}
		}
		return versions;
	}

/*--
	构建JS项目（合并压缩）
	-p obj argv 构建命令参数，例如 {_prj:'blog', _cmd:'build'}
	-p obj prj_conf 项目配置
	-p Response response http响应对象
*/
exports.build = function (argv, prj_conf, response) {
	var prj_path = prj_conf.path,
		build_path = prj_conf.build_path;
	prj_path[prj_path.length-1]==='/' || (prj_path += '/');
	build_path[build_path.length-1]==='/' || (build_path += '/');

	var charset = prj_conf.charset || 'utf8',
		versions = parseVersion(prj_path+'version.info', charset),
		CURRENT_VER = addOne(versions.LAST_VER), //当前版本号
		last_file = versions.LAST_FILE,

		cmd_spec = prj_conf.modular_spec==='CMD',
		build_data = prj_conf.build_data || {},
		comp_cmd = require('../__config').compress_cmd,
		util = require('../common/util'),

		prj_path_len = prj_path.length,
		path_uncompress = build_path+'uncompressed/',
		path_min = build_path+CURRENT_VER+'/',

		all_files = {}, //存放文件内容，以文件名为key，值为文件内容
		all_depended = {'mok':true}, //所有被引用过的文件
		main_file_dl = [], //输出到_boot.js里的主文件依赖列表
		version_fc = '', //输出到版本文件version.js里的版本字符串

		fs = require('fs'),
		UglifyJS = require('uglify-js'),
		crypto = require('crypto'),

		err_log = [], //收集错误信息
		//块注释，要先移除块注释
		reg_data_key = /\/\*{{([\D\d]+?)}}\*\//g,
		reg_comment = /\/\*[\D\d]*?\*\//g,
		reg_define = /^[\t ]*define[\t ]*\(.+$/m,
		file_req = {}, //文件名作为key，值是该文件依赖的模块数组
		start_time = Date.now(), //当前时间

		calcing = {}, //记录正在遍历的，防止循环依赖
		depended = {},
		depended_list = [];

	all_files['mok'] = fs.readFileSync('mok-js/br-mok-'+
		(cmd_spec ? 'CMD.js' : 'Modules.js'), 'utf8');
	versions['mok'] || (versions['mok'] = ['1', CURRENT_VER, '', 'mok', 'new']);
	
	//创建构建目录
	function mkdir() {
		fs.existsSync(build_path) || fs.mkdirSync(build_path);
		fs.existsSync(path_uncompress) || fs.mkdirSync(path_uncompress);
		fs.existsSync(path_min) ? fs.readdirSync(path_min).forEach(function(file){
			fs.unlinkSync(path_min + file);
		}) : fs.mkdirSync(path_min);
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
			'mok["'+util.getModuleAbbr(file.slice(0, -3))+
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
	//计算文件依赖列表，同时将文件名编码
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
		all_depended[file] = depended[file] = true;

		var encoded_name = versions[file];
		if (encoded_name) {
			encoded_name = encoded_name[0];
		} else {
			encoded_name = last_file = addOne(last_file);
			versions[file] = [encoded_name, CURRENT_VER, '', file, 'new'];
		}
		depended_list.push(encoded_name);
	}
	//读取main下的所有入口文件名
	function readMainFiles(path, files) {
		fs.readdirSync(path).forEach(function (filename) {
			var file = path+'/'+filename;
			if (filename.slice(-3)==='.js') {
				files.push(file.slice(prj_path_len + 5)); //把“main/”也去掉
			} else if (filename[0]!=='.' && fs.statSync(file).isDirectory()) {
				//排除.svn，.github之类的文件夹
				readMainFiles(file, files);
			}
		});
	}
	//计算main文件依赖列表
	function calcMainfileDL() {
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
		main_files.sort();
		
		var main_len = main_files.length,
			i = 0, j, len, main_file;
		for (; i < main_len; i++) {
			main_file = main_files[i];
			calcing = {};
			depended = {};
			if (use_common) {
				if (main_file === common_js) { //公共文件单独处理
					depended_list = commoned_list;
					depended_list.unshift('1'); //mok.js
				} else {
					for (j in commoned) {
						depended[j] = true;
					}
					depended_list = [];
					calcDependList('main/'+main_file);
				}
			} else {
				depended_list = ['1']; //mok.js
				calcDependList('main/'+main_file);
			}

			main_file_dl.push('"'+main_file.slice(0, -3)+'":"'+
				depended_list.join(',')+'"');
			all_files['main/'+main_file] +=
				'\r\nrequire("main/'+main_file.slice(0, -3)+'");';
		}
	}
	//拷贝、压缩所有有用的文件
	function compressFiles() {
		all_depended = Object.keys(all_depended).sort();
		var i, len = all_depended.length,
			file, ver, fc, fd, mini;
		if (prj_conf.output_uncompressed) {
			for (i = 0; i < len; i++) {
				file = all_depended[i];
				fd = fs.openSync(path_uncompress+versions[file][0]+'.js',
					'w', '0666');
				fs.writeSync(fd, all_files[file], 0, charset);
				fs.closeSync(fd);
			}
		}
		for (i = 0; i < len; ) {
			file = all_depended[i];
			ver = versions[file];
			mini = UglifyJS.minify(all_files[file], {fromString:true});
			fc = mini.code;
			fd = fs.openSync(path_min+ver[0]+'.js', 'w', '0666');
			fs.writeSync(fd, fc, 0, charset);
			fs.closeSync(fd);
			fc = crypto.createHash('md5').update(fc).digest('hex').slice(0, 8);
			if (ver[2]) {
				fc===ver[2] || (ver[1] = CURRENT_VER, ver[2] = fc, ver.push('updated'));
			} else {
				ver[2] = fc;
			}
			version_fc += ','+ver[0]+':'+ver[1];
			all_depended[i] = ver.join('    ');
			response.write('<script>updatePG('+(++i)+','+len+')</script>');
		}
	}
	//把版本信息、main文件依赖信息写入启动文件
	function updateBoot() {
		var fc, fd;
		//在本次版本目录下创建_boot.js文件
		fc = all_files['boot.js'];
		if (!fc) {
			err_log.push('MOKJS-006: 文件 boot.js 不存在！');
			return;
		}
		fc = fc.replace('//<VERSIONS/>', 'vers="1:'+
			versions['mok'][1]+version_fc+'".split(",");')
			.replace('//<MAINFILES/>', 'var mainFiles={'+main_file_dl.join(',')+'};');
		fc = UglifyJS.minify(fc, {fromString:true});
		fd = fs.openSync(path_min+'_boot.js', 'w', '0666');
		fs.writeSync(fd, fc.code, 0, charset);
		fs.closeSync(fd);

		//在项目根目录创建更新的version.info文件
		fd = fs.openSync(prj_path+'version-'+CURRENT_VER+'.info', 'w', '0666');
		fs.writeSync(fd, 'LAST_VER:'+CURRENT_VER+'\r\nLAST_FILE:'+last_file+
			'\r\n-'+all_depended.join('\r\n-')+'\r\n', 0, charset);
		fs.closeSync(fd);
	}
	//构建完成
	function buildDone() {
		if (err_log.length) {
			for (var ei = 0; ei < err_log.length; ei++) {
				response.write('<br/><br/>'+err_log[ei]);
			}
			response.end('<br/><br/>====== 囧，构建项目失败了 TAT...<br/></body></html>');
			return;
		}
		response.end('<br/><br/>========= 构建项目成功！<br/>========= 总共用时：'+
			(Date.now()-start_time)/1000+' s.'+util.buildTime()+'<br/><br/></body></html>');
		prj_conf.__hasbuilt = true;
		prj_conf.__version = CURRENT_VER;
	}
	
	//开始！
	mkdir();
	util.loadModuleAbbr('!'); //清除缓存数据
	//载入模块简称与全称的映射
	util.loadModuleAbbr(prj_path);

	response.writeHead(200, {'Content-Type':'text/html'});
	response.write(global.HEAD_HTML.replace('{{title}}', '构建JS项目_'+argv._prj));
	response.write('<style>.pg-wrap{width:300px;height:20px;border:1px solid #0d0;'+
		'display:inline-block;margin-top:6px}#pg{width:0;height:100%;background-color:#0d0}'+
		'#pn{margin-left:6px;height:20px;display:inline-block;}</style>'+
		'<script>function updatePG(i,len){pg.style.width=Math.ceil(i*100/len)+"%";'+
		'pn.innerHTML=""+i+"/"+len;}</script>');
	response.write('=== 正在分析每个文件的依赖 ...');
		readAllFiles(prj_path.slice(0, -1), all_files);
		parseReq();
	response.write('<br/>=== 分析完毕。');

	if (err_log.length) {
		buildDone();
		return;
	}

	calcMainfileDL();
	response.write('<br/><br/>====== 正在复制和压缩所有被依赖的文件 ...');
	response.write('<br/><div class="pg-wrap"><div id="pg"></div></div><div id="pn">0/0</div>');
	response.write('<script>var pg=document.getElementById("pg"), pn=document.getElementById("pn");</script>');
	compressFiles();
	response.write('<br/>====== 复制和压缩完毕。');
	updateBoot();
	buildDone();

};
