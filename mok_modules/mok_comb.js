	/*--
		文件合并模块
		-author hahaboy
	*/
	var FS = require('fs');

	//文件号与文件内容的map
	var file_contents = {};
	
	//合并文件，输出可执行的js文件
	exports.comb = function(file, prj_conf, response){
		//console.log('comb: '+file);
		response.writeHeader(200, {
			'Cache-Control': 'no-cache,max-age=0', //本地开发调试时别缓存
			//'Cache-Control': 'max-age=36000', //生产环境根据自己情况缓存
			'Content-Type': 'application/x-javascript',
			'Access-Control-Allow-Origin': '*'
		});
		//response.write(';'); //解决chrome下请求两次的bug
		var files = file.split('-'), i = 0, len = files.length - 1;
		for(; i < len; i++){
			response.write(file_contents[files[i].slice(2)]+'\r\r\r'); //版本号长度2
		}
		//files最后一个是xxyy.js，其中xx是版本号，yy是文件号
		response.end(file_contents[files[i].slice(2,-3)]);
	};

	//本地开发压缩后，测试本地指定版本下的压缩文件
	exports.testVersion = function(prj_conf){
		//console.log(version);
		var ver_path = prj_conf.build_path + prj_conf.__version;
		if(FS.existsSync(ver_path)){
			FS.readdir(ver_path, function(err, files){
				if(err){
					console.log('更新缓存失败！');
					return;
				}
				var charset = prj_conf.charset || 'utf8';
				var contents = {};
				var len = files.length, i = 0, file;
				for(; i < len; i++){
					file = ver_path + '/' + files[i];
					if(FS.statSync(file).isFile()){
						contents[files[i].slice(0,-3)] = FS.readFileSync(file, charset);
					}
				}
				file_contents = contents;
				console.log('更新缓存成功！更新文件总数：'+len);
			});
		}
	};

	//用于线上更新JS文件缓存到最新版本
	exports.updateToVersion = function(version, prj_conf, response){
		//console.log(version);
		var ver_path = prj_conf.build_path + version;
		if(FS.existsSync(ver_path)){ // && FS.statSync(ver_path).isDirectory()
			FS.readdir(ver_path, function(err, files){
				if(err){
					console.log('更新缓存失败！');
					return;
				}
				var charset = prj_conf.charset || 'utf8';
				var contents = {};
				var len = files.length, i = 0, file;
				for(; i < len; i++){
					file = ver_path + '/' + files[i];
					if(FS.statSync(file).isFile()){
						contents[files[i].slice(0,-3)] = FS.readFileSync(file, charset);
					}
				}
				file_contents = contents;
				console.log('更新缓存成功！更新文件总数：'+len);
			});
		}
	};
