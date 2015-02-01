/*--
	CSS模块化
	-site http://mokjs.com/moktext/
*/
var fs = require('fs'),
	crypto = require('crypto'),
	util = require('../common/util'),
	reg_data_key = /\/\*{{(\w+)}}\*\//g,
	reg_comment = /\/\*[\D\d]*?\*\//g, //注释，例如：/* CSS Document */
	reg_scs = /[;:{, }]/, //前后可能出现空白字符的符号
	//@import url('../modules/title.css');
	reg_mark = /^[\t ]*@import.*?\([\t ]*['"](.+?)['"]/,
	charset, //文件编码，默认utf8
	at_charset,
	glb_data,
	sass_config,
	sass,
	test_min = {},
	err_log = [],
	prj_path,

	combined_list,
	file_tree,
	tree_deep,
	contents;

//编译sass文件
function compileSassFile(file_content, file) {
	sass_config.data = file_content;
	try {
		sass || (sass = require('node-sass'));
		return sass.renderSync(sass_config);
	} catch (err) {
		err_log.push('MOKTEXT-006: 编译sass文件 '+file+' 出错：'+err.toString());
		return '';
	}
}
//初始化项目
function initProject(prj_conf) {
	prj_path = prj_conf.path;
	prj_path[prj_path.length-1]==='/' || (prj_path += '/');
	charset = prj_conf.charset || 'utf8';
	at_charset = charset[0].toLowerCase()==='u' ? 'utf-8' : charset;
	glb_data = prj_conf.data || {};
	err_log = [];
}
//初始化合并
function initCombine() {
	file_tree = ['@charset "'+at_charset+'";\r\n/* file tree:'];
	combined_list = {};
	tree_deep = 0;
	contents = [];
	sass_config = glb_data.sass_config || {}; //不能放在initProject里
	sass_config.includePaths = [prj_path];
}
//合并
function combine(file) {
	//console.log(file);
	combined_list[file] = true;
	file_tree.push(util.repeat('|   ', tree_deep)+'|...'+file);
	tree_deep++;
	contents.push('/* ===== '+file+' ===== */\r\n');

	var file_ext = file.slice(-4),
		fc = fs.readFileSync(prj_path+file, charset).replace(reg_data_key,
			function (input, $1) {
				return glb_data[$1.trim()] || '';
			}).replace(/^\s+/,''); //要去掉BOM头
	if (file_ext === 'scss') { //编译sass文件
		fc = compileSassFile(fc, file);
	} //else if(file_ext==='lcss'){} //TODO
	var lines = fc.replace(reg_comment, function (input) {
			return input.replace(/@import/g, '//@import');
		}).replace(/\r/g, '').split('\n'),
		i = 0, len = lines.length, line, import_file;
	for (; i < len; i++) {
		line = lines[i];
		import_file = line.match(reg_mark);
		if (import_file) {
			import_file = util.resolveHCPath(file, import_file[1].trim());
			if (combined_list[import_file]) {
				//contents.push('/* --- '+ import_file +' --- */\r\n');
				file_tree.push(util.repeat('|   ', tree_deep)+'|.  '+import_file);
			} else {
				if (fs.existsSync(prj_path+import_file) &&
					fs.statSync(prj_path+import_file).isFile() ){
					combine(import_file)
				} else {
					err_log.push('MOKTEXT-005: '+file+
						' 引用的文件 '+import_file+' 不存在！');
				}
			}
		}else{
			//过滤掉@charset "utf-8";
			line.indexOf('@charset')<0 && contents.push(line+'\r\n');
		}
	}

	tree_deep--;
}
//压缩css内容
function compressCss(fc) {
	var content = fc.replace(reg_comment, '').replace(/^[\s\r\n]+/, ''),
		i = 0, len = content.length,
		buf = '', //压缩结果buffer
		lc = '', //前一个字符
		c;
	for (; i < len; i++) {
		c = content[i];
		if (c==='\r' || c==='\n') {
			continue;
		}
		if (c===' ' || c==='\t') {
			if (reg_scs.test(lc)) {
				continue;
			}
			buf += lc;
			lc = ' ';
			continue;
		} else if (reg_scs.test(c)) {
			if (lc===' ' || (c==='}' && lc===';')) {
				lc = c;
				continue;
			}
		}
		buf += lc;
		lc = c;
	}

	return buf + lc;
}

//输出css
exports.output = function (filename, prj_conf, response) {
	initProject(prj_conf);
	var file;
	if (test_min[prj_path]) {
		var build_path = prj_conf.build_path;
		build_path[build_path.length-1]==='/' || (build_path += '/');
		file = build_path+'min/'+filename.slice(5); //去掉main/xxx.css的main/
		if (fs.existsSync(file)) {
			fs.readFile(file, 'binary', function (err, filedata) {
				if (err) {
					response.writeHead(500, {'Content-Type':'text/plain'});
					response.end('MOKJS-500: Read file error. Maybe ['+file+
						'] is not a file. \n'+err.toString());
				} else {
					response.writeHead(200, {'Content-Type':'text/css',
						'Cache-Control':'max-age=0'});
					response.write(filedata, 'binary');
					response.end();
				}
			});
		} else {
			response.writeHead(200, {'Content-Type':'text/plain'});
			response.end('MOKTEXT-101: ['+file+
				'] is not found. The project is likely not built.');
		}
		glb_data = sass_config = null;
		return;
	}
	file = prj_path + filename;
	if (fs.existsSync(file) && fs.statSync(file).isFile()) {
		initCombine();
		combine(filename);
		response.writeHead(200, {'Content-Type':'text/css','Cache-Control':'max-age=0'});
		if (err_log.length) {
			response.end(err_log.join('\r\n'));
			console.log(err_log.join('\r\n'));
		} else {
			response.write(file_tree.join('\r\n')+'\r\n*/\r\n');
			response.end(contents.join(''));
		}
		err_log = contents = combined_list = glb_data = sass_config = null;
	}else{
		response.writeHead(200, {'Content-Type':'text/plain'});
		response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
	}
};

//切换测试模式
exports.testMin = function (prj_conf, response) {
	prj_path = prj_conf.path; prj_path[prj_path.length-1]==='/' || (prj_path += '/');
	test_min[prj_path] = !test_min[prj_path];
	response.writeHead(200, {'Content-Type':'text/html','Cache-Control':'max-age=0'});
	response.end(global.HEAD_HTML.replace('{{title}}', '切换测试CSS压缩文件模式')+
		'已 <strong>'+(test_min[prj_path]?'切换到':'取消')+
		'</strong> 测试CSS压缩文件模式。</body></html>');
};

//构建项目。argv 构建命令参数，例如 {_prj:'blog', _cmd:'build'}
exports.build = function (argv, prj_conf, response) {
	initProject(prj_conf);
	response || (response = util.fakeResponse);
	response.writeHead(200, {'Content-Type':'text/html','Cache-Control':'max-age=0'});
	response._fake_ ||
		response.write(global.HEAD_HTML.replace('{{title}}', '合并压缩CSS文件')+
			'<script>' + fs.readFileSync('mok-js/br-build.js','utf8')+'</script>');

	var build_path = prj_conf.build_path;
	build_path[build_path.length-1]==='/' || (build_path += '/');
	var path_main = build_path+'main/',
		path_min = build_path+'min/',
		path_updated = build_path+'updated/',
		path_tag, //待上线的tag版本，放在updated文件夹下
		path_main_len = prj_path.length + 5,

		abc_newverstr, abc_a = '', abc_c = '', //abc指代版本文件version_file的相关名称
		abc_name2ver = {}, //存放所有的文件名及对应的版本号
		abc_allname = [], //存放所有的文件名，用于输出version_file时排序所有文件
		abc_isnew = {}, //存放新增加的文件，以文件名为key，值为true
		
		zip = argv.hasOwnProperty('zip'),
		version_file = prj_conf.version_file,
		version = argv.v || '',
		start_time = Date.now();

	fs.existsSync(build_path) || fs.mkdirSync(build_path);
	fs.existsSync(path_main) || fs.mkdirSync(path_main);
	fs.existsSync(path_min) ? util.cleardir(path_min) : fs.mkdirSync(path_min);
	fs.existsSync(path_updated) || fs.mkdirSync(path_updated);

	function init() {
		if (prj_conf.format_tag) {
			var ret = prj_conf.format_tag(version);
			abc_newverstr = ret.version;
			path_tag = path_updated+ret.folder_name+'/';
		} else if (version) {
			abc_newverstr = version+'/';
			path_tag = path_updated+version+'/';
		} else {	//没有版本
			version_file = path_tag = false;
			return;
		}
		fs.existsSync(path_tag) ? util.cleardir(path_tag) : fs.mkdirSync(path_tag);
		
		if (version_file) {	//判断版本文件是否真的存在
			fs.existsSync(prj_path+version_file) || (version_file = false);
		}
		//解析当前版本号
		if (version_file) {
			var vers = fs.readFileSync(prj_path+version_file,
				'utf8').split('<version>'),
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
					abc_name2ver[vs[1]+'.css'] = vs[3];
				}
			}
		}
		//需要生成zip
		if (zip) {
			try {zip = require('archiver')} catch (e) {zip = false}
		}
		//并且有zip模块
		if (zip) {
			//生成压缩文档
			zip = zip('zip');
			zip.on('error', function (err) {
				err_log.push('<br/>MOKTEXT-701: 生成zip压缩包的过程中出现异常！'+
					'<br/>错误信息：'+err.toString());
			});
			zip.pipe(fs.createWriteStream(path_tag.slice(0, -1)+'.zip'));
		} else {
			//构造伪zip对象
			zip = {
				append: function () {},
				finalize: function (callback) {callback()}
			};
		}
	}
	//读取main下的所有入口文件名，遇到子目录则在构建目录里创建相应的子目录
	function readMainFiles(path, files) {
		fs.readdirSync(path).forEach(function (filename) {
			var file = path+'/'+filename,
				file_ext = filename.slice(filename.lastIndexOf('.') + 1);;
			if (file_ext==='css' || file_ext==='scss') {
				files.push(file.slice(path_main_len)); //把“main/”也去掉
			} else if (filename[0]!=='.' && fs.statSync(file).isDirectory()) {
				//排除.svn，.github之类的文件夹
				readMainFiles(file, files);
				//在构建目录的main和min里创建对应的目录
				file = file.slice(path_main_len)+'/';
				util.mkdir(path_main, file);
				util.mkdir(path_min, file);
				version_file || util.mkdir(path_tag, file);
			}
		});
	}
	//更新版本控制文件
	function updateAbcFile() {
		var content = '<version> */', fd, k;
		abc_allname.sort().forEach(function(name){
			if (abc_name2ver[name]) {
				content += '\r\n"'+name.slice(0, -4)+'": "'+abc_name2ver[name]+'",';
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
				k = fs.readFileSync(path_min+name, charset);
				fd = fs.openSync(path_tag+name, 'w', '0666');
				fs.writeSync(fd, k, 0, charset);
				fs.closeSync(fd);
				zip.append(k, {name:name});
			}
		});
		k = '';
		for (k in abc_name2ver) {
			content += '\r\n/*"'+k.slice(0, -4)+'": "'+abc_name2ver[k]+'", del*/';
		}
		content = abc_a+content+'\r\n/* </version>'+abc_c;

		//复制version_file文件到打包项目的目录下，命名为update-version_file，
		//提交SVN时先删除已有的version_file，
		//再把updated-version_file重命名为version_file，即实现更新version_file
		fd = fs.openSync(prj_path+'updated-'+version_file, 'w', '0666');
		fs.writeSync(fd, content, 0, 'utf8');
		fs.closeSync(fd);
		k && response.write('<br /><br/>MOKTEXT-051: 有main文件被删除了：'+k+' 等。');
	}
	//合并和压缩
	function combineAndCompress() {
		response.write(''); //让控制台输出一个空行
		var compress_done = !!prj_conf.compress_done && prj_conf.compress_done;
		
		var main_files = [];
		readMainFiles(prj_path+'main', main_files);

		var main_len = main_files.length,
			i = 0,
			main_file, fc, fd, file_md5;
		for (; i < main_len; i++) {
			main_file = main_files[i];
			response.write('<br />=== 正在合并和压缩文件 '+main_file+
				' 　--- '+(main_len - i));
			abc_allname.push(main_file);
			initCombine();
			combine('main/'+main_file);
			if (err_log.length) {break}
			fc = file_tree.join('\r\n')+'\r\n*/\r\n'+contents.join('');
			
			//没压缩的文件写到all下
			fd = fs.openSync(path_main+main_file, 'w', '0666');
			fs.writeSync(fd, fc, 0, charset);
			fs.closeSync(fd);

			fc = compressCss(fc);
			compress_done && (fc = compress_done(fc));

			//压缩过的文件写到main下
			fd = fs.openSync(path_min+main_file, 'w', '0666');
			fs.writeSync(fd, fc, 0, charset);
			fs.closeSync(fd);

			if (version_file) {
				//检查文件是否有修改
				//file_md5 = '|' + crypto.createHash('md5').update(fs.readFileSync(
				//	path_min + main_file, charset)).digest('hex').slice(0, 8);
				file_md5 = '|'+crypto.createHash('md5').update(fc)
					.digest('hex').slice(0, 8);
				if (abc_name2ver[main_file] &&
					abc_name2ver[main_file].indexOf(file_md5)>0) {
					//文件未更改
				} else {
					abc_name2ver[main_file] || (abc_isnew[main_file] = true);
					abc_name2ver[main_file] = abc_newverstr+file_md5;
				}
			} else if (path_tag) {
				fd = fs.openSync(path_tag+main_file, 'w', '0666');
				fs.writeSync(fd, fc, 0, charset);
				fs.closeSync(fd);
				zip.append(fc, {name:main_file});
			}
		}
		contents = combined_list = glb_data = sass_config = null;
	}
	function buildDone() {
		version_file && err_log.length===0 && updateAbcFile();
		zip.finalize(function (err) {
			err && err_log.push('<br/>MOKTEXT-702: 生成zip压缩包失败！<br/>错误信息：'+
				err.toString());
		});
		if (err_log.length) {
			response.write('<br />'); //来个换行
			for (var ei = 0; ei < err_log.length; ei++) {
				response.write('<br />'+err_log[ei]);
			}
			response.end('<br /><br/>====== 囧，合并压缩失败了 TAT...'+
				'<br/></body></html>');
			err_log = null;
			return;
		}
		response.write('<br /><br/>====== 合并压缩成功！');
		response.write('<br />====== 总共用时：'+
			(Date.now()-start_time)/1000 +' s.'+util.buildTime());
		response.end('<br /><br/></body></html>');
		typeof prj_conf.build_done==='function' &&
			prj_conf.build_done(argv, path_tag, abc_newverstr);
	}

	init();
	combineAndCompress();
	buildDone();
};
