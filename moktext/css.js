/*--
	CSS模块化
	-version 1.0.0
	-site http://mokjs.com/moktext/
*/
var FS = require('fs'),
	crypto = require('crypto'),
	util = require('../common/util'),
	reg_comment = /\/\*[\D\d]*?\*\//g, //注释，例如：/* CSS Document */
	reg_mark = /^[\t ]*@import.*?\([\t ]*['"](.+?)['"]/, //@import url('../modules/title.css');
	charset, //文件编码，默认utf8
	test_min = {},
	err_log = [],
	prj_path,

	combined_list,
	file_tree,
	tree_deep,
	contents;

//初始化合并
function initCombine(){
	file_tree = ['@charset "'+(charset[0].toLowerCase()==='u'?'utf-8':charset)+
		'";\r\n/* file tree:'];
	combined_list = {};
	tree_deep = 0;
	contents = [];
}
//合并
function combine(file){ //console.log(file);
	combined_list[file] = true;
	file_tree.push(util.repeat('|   ', tree_deep)+'|...'+file);
	tree_deep++;
	contents.push('/* ===== '+ file +' ===== */\r\n');

	var lines = FS.readFileSync(prj_path+file, charset).replace(reg_comment,
		'').replace(/^\s+/g,'').replace(/\r/g,'').split('\n'), //要去掉BOM头
		i = 0, len = lines.length, line, import_file;
	for(; i < len; i++){
		line = lines[i];
		import_file = line.match(reg_mark);
		if(import_file){
			import_file = util.resolveHCPath(file, import_file[1].trim());
			if(combined_list[import_file]){
				//contents.push('/* --- '+ import_file +' --- */\r\n');
				file_tree.push(util.repeat('|   ', tree_deep)+'|.  '+import_file);
			}else{
				FS.existsSync(prj_path+import_file) && FS.statSync(prj_path+
					import_file).isFile() ? combine(import_file) :
					err_log.push('MOKTEXT-005: '+file+' 引用的文件 '+import_file+' 不存在！');
			}
		}else{
			//过滤掉@charset "utf-8";
			line.indexOf('@charset')<0 && contents.push(line + '\r\n');
		}
	}

	tree_deep--;
}

//输出css
exports.output = function(filename, prj_conf, response){
	prj_path = prj_conf.path; prj_path[prj_path.length-1]==='/' || (prj_path+='/');
	var file;
	if(test_min[prj_path]){
		var build_path = prj_conf.build_path; build_path[build_path.length-1]==='/' || (build_path+='/');
		file = build_path+'min/'+filename.slice(5); //去掉main/xxx.css的main/
		if(FS.existsSync(file)){
			FS.readFile(file, 'binary', function(err, filedata){
				if(err){
					response.writeHead(500, {'Content-Type':'text/plain'});
					response.end('MOKJS-500: Read file error. Maybe ['+file+
						'] is not a file. \n'+err.toString());
				}else{
					response.writeHead(200, {'Content-Type':'text/css',
						'Cache-Control':'max-age=0'});
					response.write(filedata, 'binary');
					response.end();
				}
			});
		}else{
			response.writeHead(200, {'Content-Type':'text/plain'});
			response.end('MOKTEXT-101: ['+file+'] is not found. The project is likely not built.');
		}
		return;
	}
	file = prj_path + filename;
	if(FS.existsSync(file) && FS.statSync(file).isFile()){
		charset = prj_conf.charset || 'utf8';
		err_log = [];
		initCombine();
		combine(filename);
		response.writeHead(200, {'Content-Type':'text/css','Cache-Control':'max-age=0'});
		if(err_log.length){
			response.end(err_log.join('\r\n'));
			console.log(err_log.join('\r\n'));
		}else{
			response.write(file_tree.join('\r\n')+'\r\n*/\r\n');
			response.end(contents.join(''));
		}
		err_log = contents = combined_list = null;
	}else{
		response.writeHead(200, {'Content-Type':'text/plain'});
		response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
	}
};
//切换测试模式
exports.testMin = function(prj_conf, response){
	prj_path = prj_conf.path; prj_path[prj_path.length-1]==='/' || (prj_path+='/');
	test_min[prj_path] = !test_min[prj_path];
	response.writeHead(200, {'Content-Type':'text/html','Cache-Control':'max-age=0'});
	response.end(global.HEAD_HTML.replace('{{title}}', '切换测试CSS压缩文件模式')+
		'已 <strong>'+(test_min[prj_path]?'切换到':'取消')+
		'</strong> 测试CSS压缩文件模式。</body></html>');
};
//argv is like this: {_prj:'lecss', _cmd:'build', v:'1620', zip:''}
exports.build = function(argv, prj_conf, response){
	prj_path = prj_conf.path; prj_path[prj_path.length-1]==='/' || (prj_path+='/');
	charset = prj_conf.charset || 'utf8';
	err_log = [];

	response || (response = util.fakeResponse);
	response.writeHead(200, {'Content-Type':'text/html','Cache-Control':'max-age=0'});
	response._fake_ || response.write(global.HEAD_HTML.replace('{{title}}',
		'合并压缩CSS文件')+'<script>'+FS.readFileSync('mok-js/br-build.js','utf8')+'</script>');

	var build_path = prj_conf.build_path; build_path[build_path.length-1]==='/' || (build_path+='/');
	var reg_fen_s = /; /g, //分号+空格，例如：width:986px; margin:0 auto;
		reg_rn = /[\r\n]+/g, //回车，换行
		reg_kuo_s = /\{ /g, //.Letv-tui{ margin:10px
		reg_fen_kuo = /;[ \t]*\}/g, //.Letv-tui{width:1186px; }
		reg_mao_s = /: /g, //.Letv-tui{margin: 10px auto 0}
		reg_dou_s = /, /g, //.Korea, .Banner, .Letv-tui{margin:10px
		reg_s_kuo = / \{/g, //.Letv-tui {margin:10px

		version_file = prj_conf.version_file,
		path_main = build_path+'main/',
		path_min = build_path+'min/',
		path_updated = build_path+'updated/',
		path_tag, //待上线的tag版本，放在updated文件夹下

		abc_newverstr, abc_a, abc_c, //abc指代版本文件version_file的相关名称
		abc_name2ver = {}, //存放所有的文件名及对应的版本号
		abc_allname = [], //存放所有的文件名，用于输出version_file时排序所有文件
		abc_isnew = {}, //存放新增加的文件，以文件名为key，值为true
		
		zip = argv.hasOwnProperty('zip'),
		version = argv.v || '',
		start_time = Date.now();

	FS.existsSync(build_path) || FS.mkdirSync(build_path);
	FS.existsSync(path_main) || FS.mkdirSync(path_main);
	FS.existsSync(path_min) ? FS.readdirSync(path_min).forEach(function(file){
		FS.unlinkSync(path_min+file);
	}) : FS.mkdirSync(path_min);
	FS.existsSync(path_updated) || FS.mkdirSync(path_updated);

	!function(){
		if(prj_conf.format_tag){
			var ret = prj_conf.format_tag(version);
			abc_newverstr = ret.version;
			path_tag = path_updated + ret.folder_name + '/';
		}else if(version){
			abc_newverstr = version + '/';
			path_tag = path_updated + version + '/';
		}else{
			version = false;
			return; //没有版本
		}
		//version表示不只有版本号，还有version_file也存在
		version = !!version_file && FS.existsSync(prj_path+version_file);
		FS.existsSync(path_tag) ? FS.readdirSync(path_tag).forEach(function(file){
			FS.unlinkSync(path_tag+file);
		}) : FS.mkdirSync(path_tag);
		
		//解析当前版本号
		if(version){
			var vers = FS.readFileSync(prj_path+version_file, 'utf8').split('<version>'),
				len, vs, quot;
			if(vers.length<2){return}
			abc_a = vers[0];
			vers = vers[1].split('</version>');
			abc_c = vers[1];
			vers = vers[0].split('\n');
			for(i = 0, len = vers.length; i < len; i++){
				quot = vers[i].match(/^[\t ]*(["'])/);
				if(quot){
					vs = vers[i].split(/"|'/);
					abc_name2ver[ vs[1]+'.css' ] = vs[3];
				}
			}
		}
		//需要生成zip
		if(zip){
			try{zip = require('archiver')}catch(e){zip = false}
		}
		//并且有zip模块
		if(zip){
			//生成压缩文档
			zip = zip('zip');
			zip.on('error', function(err){
				response.end('<br/>MOKTEXT-701: 生成zip压缩包的过程中出现异常！<br/>错误信息：'
					+err.toString()+'</body></html>');
			});
			zip.pipe( FS.createWriteStream(path_tag.slice(0,-1)+'.zip') );
		}else{
			//构造伪zip对象
			zip = {
				append: function(){},
				finalize: function(callback){callback()}
			};
		}
	}();
	//更新版本文件
	var updateAbcFile = function(){
		var content = '<version> */', fd, k;
		abc_allname.sort().forEach(function(name){
			if(abc_name2ver[name]){
				content += '\r\n"'+name.slice(0,-4)+'": "'+abc_name2ver[name]+'",';
				if(abc_isnew[name]){
					content += ' /*new*/';
				}else if(abc_name2ver[name].indexOf(abc_newverstr)===0){
					content += ' /*u*/';
				}else{
					delete abc_name2ver[name];
					return;
				}
				delete abc_name2ver[name];
				//复制有变化的文件
				k = FS.readFileSync(path_min+name, charset);
				fd = FS.openSync(path_tag+name, 'w', '0666');
				FS.writeSync(fd, k, 0, charset);
				FS.closeSync(fd);
				zip.append(k, {name:name});
			}
		});
		k = '';
		for(k in abc_name2ver){
			content += '\r\n/*"'+k.slice(0,-4)+'": "'+abc_name2ver[k]+'", del*/';
		}
		content = abc_a+content+'\r\n/* </version>'+abc_c;

		//复制version_file文件到打包项目的目录下，命名为update-version_file，
		//提交SVN时先删除已有的version_file，
		//再把updated-version_file重命名为version_file，即实现更新version_file
		fd = FS.openSync(prj_path+'updated-'+version_file, 'w', '0666');
		FS.writeSync(fd, content, 0, 'utf8');
		FS.closeSync(fd);
		k && response.write('<br /><br/>MOKTEXT-051: 请注意有main文件被删除了：'+k+' 等。');
	};

	var main_files = FS.readdirSync(prj_path+'main'),
		main_len = main_files.length,
		main_file, fc, fd, file_md5; //console.log(main_files)
	response.write(''); //让控制台输出一个空行
	for(var i = 0; i < main_len; i++){
		main_file = main_files[i];
		//过滤非css文件
		if(main_file.slice(-4)==='.css'){
			response.write('<br />=== 正在合并和压缩文件 '+main_file+' 　--- '+(main_len-i));
			abc_allname.push(main_file);
			initCombine();
			combine('main/'+main_file);
			fc = file_tree.join('\r\n') + '\r\n*/\r\n' + contents.join('');
			
			//没压缩的文件写到all下
			fd = FS.openSync(path_main+main_file, 'w', '0666');
			FS.writeSync(fd, fc, 0, charset);
			FS.closeSync(fd);

			fc = fc
				.replace(reg_fen_s, ';') //从多到少排序
				.replace(reg_rn, '')
				.replace(reg_kuo_s, '{')
				.replace(reg_fen_kuo, '}')
				.replace(reg_comment, '')
				.replace(reg_mao_s, ':')
				.replace(reg_dou_s, ',')
				.replace(reg_s_kuo, '{');

			//压缩过的文件写到main下
			fd = FS.openSync(path_min+main_file, 'w', '0666');
			FS.writeSync(fd, fc, 0, charset);
			FS.closeSync(fd);

			if(version){
				//检查文件是否有修改
				file_md5 = '|'+crypto.createHash('md5').update(FS.readFileSync(
					path_min+main_file, charset)).digest('hex').slice(0, 8);
				if(abc_name2ver[main_file] && abc_name2ver[main_file].indexOf(file_md5)>0){
					//文件未更改
				}else{
					abc_name2ver[main_file] || (abc_isnew[main_file] = true);
					abc_name2ver[main_file] = abc_newverstr + file_md5;
				}
			}
		}
	}
	contents = combined_list = null;
	if(err_log.length){
		response.write('<br />'); //来个换行
		for(var ei = 0; ei < err_log.length; ei++){
			response.write('<br />'+err_log[ei]);
		}
		response.end('<br /><br/>====== 囧，合并压缩失败了 TAT...<br/></body></html>');
		err_log = null;
		return;
	}
	
	version && updateAbcFile();
	zip.finalize(function(err){
		err && response.end('<br/>MOKTEXT-702: 生成zip压缩包失败！<br/>错误信息：'
			+err.toString()+'</body></html>');
	});
	response.write('<br /><br/>====== 合并压缩成功！');
	response.write('<br />====== 总共用时：'+(Date.now()-start_time)/1000+' s.'+util.buildTime());
	response.end('<br /><br/></body></html>');
	typeof prj_conf.build_done==='function' && prj_conf.build_done(argv, path_tag, abc_newverstr);
};
