//argv is like this: {_prj:'blog', _cmd:'build', v:'20130520', lazy:''}
exports.build = function(argv, prj_conf, response){

	var prj_path = prj_conf.path, build_path = prj_conf.build_path;
	prj_path[prj_path.length-1]==='/' || (prj_path+='/');
	build_path[build_path.length-1]==='/' || (build_path+='/');

	var boot_js = prj_conf.boot_js,
		tag_num = argv.v,
		lazy_mode = argv.hasOwnProperty('lazy'),
		node_mode = prj_conf.compile_mode==='node',
		lazy_list = prj_conf.lazy_list,
		charset = prj_conf.charset || 'utf8',
		comp_cmd = require('../__config').compress_cmd,
		util = require('../common/util'),

		prj_path_len = prj_path.length,
		path_main = build_path+'main/',
		path_min = build_path+'min/',
		path_updated = build_path+'updated/',
		path_tag, //待上线的tag版本，放在updated文件夹下

		abc_newverstr, abc_a, abc_c,
		abc_name2ver = {}, //存放所有的文件名及对应的版本号
		abc_allname = [], //存放所有的文件名，用于输出boot_js时排序所有文件
		abc_isnew = {}, //存放新增加的文件，以文件名为key，值为true
		all_files = {}, //存放文件内容，以文件名为key，值为文件内容

		FS = require('fs'),
		child_process = require('child_process'),
		crypto = require('crypto'),
		zip = argv.hasOwnProperty('zip'),

		err_log = [], //收集编译错误信息
		br_mok = FS.readFileSync('mok-js/br-mok'+(node_mode?'-node.js':'-define.js'), 'utf8'),
		//块注释，要先移除块注释
		reg_comment = /\/\*[\D\d]*?\*\//g,
		reg_define = /^[\t ]*define[\t ]*\(.+$/m,
		file_req = {}, //文件名作为key，值是该文件依赖的模块数组
		start_time = Date.now(), //当前时间

		main_len, main_count = 0,
		calcing = {}, //记录正在遍历的，防止循环依赖
		depended = {},
		depend_list = [],
		awdepended, //always depended
		awdepend_list;

	//处理压缩命令
	comp_cmd = comp_cmd.replace('{filename}', path_main+';'
		).replace('{filename}', path_min+';');
	comp_cmd[0]==='j' && (comp_cmd+=' --charset '+charset); //YUICompressor

//创建构建目录
function mkdir(){
	FS.existsSync(build_path) || FS.mkdirSync(build_path);
	FS.existsSync(path_updated) || FS.mkdirSync(path_updated);
	FS.existsSync(path_main) || FS.mkdirSync(path_main);
	FS.existsSync(path_min) ? FS.readdirSync(path_min).forEach(function(file){
		FS.unlinkSync(path_min+file);
	}) : FS.mkdirSync(path_min);
}
//读取版本文件
function readVersion(){
	if(prj_conf.format_tag){
		var ret = prj_conf.format_tag(tag_num);
		abc_newverstr = ret.version;
		path_tag = path_updated + ret.folder_name + '/';
	}else{
		abc_newverstr = tag_num + '/';
		path_tag = path_updated + tag_num + '/';
	}
	FS.existsSync(path_tag) ? FS.readdirSync(path_tag).forEach(function(file){
		FS.unlinkSync(path_tag+file);
	}) : FS.mkdirSync(path_tag);
	//tag_num表示不只有版本号，还有boot_js也存在
	tag_num = !!boot_js && FS.existsSync(prj_path+boot_js);
	//解析当前版本号
	if(tag_num){
		var vers = FS.readFileSync(prj_path+boot_js, charset).split('<version>'),
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
				abc_name2ver[ vs[1]+'.js' ] = vs[3];
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
			response.end('<br/>MOKJS-701: 生成zip压缩包的过程中出现异常！<br/>错误信息：'+
				err.toString()+'</body></html>');
		});
		zip.pipe( FS.createWriteStream(path_tag.slice(0,-1)+'.zip') );
	}else{
		//构造伪zip对象
		zip = {
			append: function(){},
			finalize: function(callback){callback()}
		};
	}
}
//分析依赖：使用 define(function(require, exports, module){}); 方式
function parseRequireDefine(file){ //console.log(file);
	var file_content = [];
	file_content.push('\r\n/* ===== '+ file +' ===== */');

	var lines = all_files[file].replace(reg_define, function(mark){
			return mark.replace(/define[\t ]*\(/, ';(mok["'+
				util.getModuleAbbr(file.slice(0,-3))+'"]=');
		}).split('\n'),
		i = 0, len = lines.length, line, req_ms, r,
		depend_ms = [];
	for(; i < len; i++){
		line = lines[i];
		if(line.indexOf('require')<0){ //90%以上无require吧
			file_content.push(line);
		}else{
			req_ms = util.parseRequire(line, file);
			r = req_ms[0];
			req_ms = req_ms[1]; //复用req_ms
			while(req_ms.length){
				line = req_ms.shift(); //复用line
				if(line.slice(-3)==='.js'){
					r = '//MOKJS ' + r;
				}else{
					line += '.js'; 
				}
				depend_ms.push(line);
				all_files[line] || err_log.push('MOKJS-005: '+file+' 依赖的模块 '+
					line.slice(0,-3)+' 不存在！<br/>line '+(i+1)+': '+lines[i]);
			}
			file_content.push(r);
		}
	}
	depend_ms.length && (file_req[file] = depend_ms);

	all_files[file] = file_content.join('\r\n');
}
//分析依赖：使用node定义模块的方式
function parseRequire(file){
	var file_content = [];
	file_content.push('\r\n/* ===== '+ file +' ===== */\r\n'+
		'mok["'+util.getModuleAbbr(file.slice(0,-3))+
		'"]=function(require, module, exports){');

	var lines = all_files[file].split('\n'),
		i = 0, len = lines.length, line, req_ms,
		depend_ms = [];
	for(; i < len; i++){
		line = lines[i];
		if(line.indexOf('require')<0){ //90%以上无require吧
			file_content.push(line);
		}else{
			req_ms = util.parseRequire(line, file); //console.log(req_ms)
			file_content.push(req_ms[0]);
			req_ms = req_ms[1]; //复用req_ms
			while(req_ms.length){
				line = req_ms.shift() + '.js'; //复用line
				depend_ms.push(line);
				all_files[line] || err_log.push('MOKJS-005: '+file+' 依赖的模块 '+
					line.slice(0,-3)+' 不存在！<br/>line '+(i+1)+': '+lines[i]);
			}
		}
	}
	depend_ms.length && (file_req[file] = depend_ms);

	file_content.push('};\r\n');
	all_files[file] = file_content.join('\r\n');
}
//读取所有文件
function readAllFiles(path){
	FS.readdirSync(path).forEach(function(filename){
		var file = path+'/'+filename; //console.log(file);
		if(FS.statSync(file).isFile()){
			if(filename.slice(-3)==='.js'){
				all_files[file.slice(prj_path_len)] = FS.readFileSync(file, 
					charset).replace(reg_comment, '').replace(/\r/g, '');
			}
		}else if(filename[0]!=='.'){ //排除.svn，.github之类的文件夹
			readAllFiles(file);
		}
	});
}
//解析require语法
function parseReq(){
	for(var i in all_files){
		node_mode ? parseRequire(i) : parseRequireDefine(i);
	}
}
function calcDependList(file){
	calcing[file] = true;
	var reqs = file_req[file];
	if(reqs){
		for(var i = 0, len = reqs.length, fi; i < len; i++){
			fi = reqs[i];
			if(depended[fi] || calcing[fi]){
				continue;
			}
			calcDependList(fi);
		}
	}
	depend_list.push(file);
	depended[file] = true;
}
function updateAbcFile(){
	var content = '<version> */', fd, k;
	abc_allname.sort().forEach(function(name){
		if(abc_name2ver[name]){
			content += '\r\n"'+name.slice(0,-3)+'": "'+abc_name2ver[name]+'",';
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
		content += '\r\n/*"'+k.slice(0,-3)+'": "'+abc_name2ver[k]+'", del*/';
	}
	content = abc_a+content+'\r\n/* </version>'+abc_c;
	fd = FS.openSync(path_tag+boot_js, 'w', '0666');
	FS.writeSync(fd, content, 0, charset);
	FS.closeSync(fd);
	fd = FS.openSync(path_min+boot_js, 'w', '0666'); //复制boot_js文件到min目录下
	FS.writeSync(fd, content, 0, charset);
	FS.closeSync(fd);
	//复制abc.js文件到打包项目的目录下，命名为update-abc.js，提交SVN时先删除已有的abc.js，
	//再把update-abc.js重命名为abc.js，即实现更新abc.js
	fd = FS.openSync(prj_path+'updated-'+boot_js, 'w', '0666');
	FS.writeSync(fd, content, 0, charset);
	FS.closeSync(fd);
	zip.append(content, {name:boot_js});
	zip.finalize(function(err){
		err && response.end('<br/>MOKJS-702: 生成zip压缩包失败！<br/>错误信息：'
			+err.toString()+'</body></html>');
	});
	k && response.write('<br/>MOKJS-051: 请注意有main文件被删除了：'+k+' 等。');
	response.write('<br/><br/>========= 合并压缩成功！<br/>========= 总共用时：'+
		(Date.now()-start_time)/1000+' s.'+util.buildTime());
	response.end('<br/><br/></body></html>');
}
//没有tag_num打包时，打包结束后，需要把项目下的boot_js拷贝到min下
function copyAbcFile(){
	if(boot_js && FS.existsSync(prj_path+boot_js)){
		var fd = FS.openSync(path_min+boot_js, 'w', '0666');
		FS.writeSync(fd, FS.readFileSync(prj_path+boot_js,charset), 0, charset);
		FS.closeSync(fd);
	}
	response.end('<br/><br/>========= 合并压缩成功！<br/>========= 总共用时：'+
		(Date.now()-start_time)/1000+' s.'+util.buildTime()+'<br/><br/></body></html>');
}
//压缩文件
function compressFile(file){
	child_process.exec(comp_cmd.replace(/;/g, file), function(err){
		if(err){
			response.end('<br/><br/>MOKJS-006: 压缩出错，文件：'+path_main+file
				+'<br/>错误信息：'+err.toString()+'</body></html>');
			return;
		}
		if(tag_num){
			//检查文件是否有修改
			var file_md5 = '|'+crypto.createHash('md5').update(FS.readFileSync(
				path_min+file, charset)).digest('hex').slice(0, 8);
			if(abc_name2ver[file] && abc_name2ver[file].indexOf(file_md5)>0){
				//文件未更改
			}else{
				abc_name2ver[file] || (abc_isnew[file] = true);
				abc_name2ver[file] = abc_newverstr + file_md5;
			}
		}
		if(++main_count===main_len){ //这才算整个打包过程完成哟
			tag_num ? updateAbcFile() : copyAbcFile();
		}
	});
}
//合并和压缩
function combineAndCompress(){
	prj_conf.use_base && calcDependList('main/base.js');
	awdepended = depended;
	awdepend_list = depend_list;

	var main_files = FS.readdirSync(prj_path+'main'), main_file;
	main_len = main_files.length;
	//过滤非js文件
	while(main_len--){
		main_file = main_files[main_len];
		if(!main_file || main_file.slice(-3)!=='.js'){
			main_files.splice(main_len, 1);
		}
	}
	main_len = main_files.length;
	response.write('<br/>');
	for(var i = 0; i < main_len; i++){
		main_file = main_files[i];
		response.write('<br/>====== 正在合并和压缩文件 '+main_file+' 　--- '+(main_len-i));
		main_len-i===1 && response.write('<br/>====== 正在努力压缩ing ...');
		abc_allname.push(main_file);
		if(lazy_mode && lazy_list[main_file]){ //在惰性打包列表
			main_count++;
			continue;
		}
		if(main_file==='base.js'){ //base.js只能单独处理
			depend_list = awdepend_list.slice(0);
		}else{
			calcing = {};
			depended = {};
			for(var aw in awdepended){depended[aw]=true}
			depend_list = [];
			calcDependList('main/'+main_file);
		}

		//合并文件
		var j = 0, dl = depend_list.length,
			fd = FS.openSync(path_main+main_file, 'w', '0666'),
			position = FS.writeSync(fd, br_mok, 0, charset);
		for(; j < dl; j++){ //必须正序
			position += FS.writeSync(fd, '\r\n'+all_files[depend_list[j]], position, charset);
		}
		FS.writeSync(fd, '\r\nrequire("main/'+main_file.slice(0,-3)+'");\r\n',
			position, charset);
		FS.closeSync(fd);
		
		compressFile(main_file);
	}
}
	
	//开始！
	mkdir();
	tag_num && readVersion();
	//载入模块简称与全称的映射
	util.loadModuleAbbr('!!!'); //清除缓存数据
	util.loadModuleAbbr(prj_path);

	response.writeHead(200, {'Content-Type':'text/html'});
	response.write(global.HEAD_HTML.replace('{{title}}', '合并压缩JS文件')+
		'<script>'+FS.readFileSync('mok-js/br-build.js','utf8')+'</script>');
	response.write('=== 正在分析文件依赖 ...');
		readAllFiles(prj_path.slice(0,-1));
		parseReq();
	response.write('<br/>=== 分析完毕。');
	if(err_log.length){
		for(var ei = 0; ei < err_log.length; ei++){
			response.write('<br/><br/>'+err_log[ei]);
		}
		response.end('<br/><br/>====== 囧，合并压缩失败了 TAT...<br/></body></html>');
		return;
	}
	combineAndCompress();

};
