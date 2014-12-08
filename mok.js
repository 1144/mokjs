/*--
	mokjs - 前端模块化开发框架 - 模客JS
	-author hahaboy | @攻城氏
	-site http://mokjs.com/
*/
var URL = require('url'),
	PATH = require('path'),
	FS = require('fs'),
	MIME = require('./common/mime'),
	CONF = require('./__config'),
	updateConf = true, //是否更新config
	mokjs = require('./mok-js/main'),
	allRoutes = CONF.routes,
	outputJs = mokjs.output,
	testMin = {}; //项目是否处于测试压缩文件模式

global.HEAD_HTML = FS.readFileSync('./common/head.html', 'utf8');

FS.watch('./__config.js', function(en){
	if(updateConf && en==='change'){ //防止重复触发
		require.cache[require.resolve('./__config')] = null;
		try{
			CONF = require('./__config');
			allRoutes = CONF.routes;
		}catch(e){
			console.log('MOKJS-101: 配置文件语法错误！\n'+e);
		}
		//console.log('__config.js changed');
		updateConf = false;
		setTimeout(function(){updateConf = true}, 1);
	}
});

function onRequest(request, response, port){
	var req_path = URL.parse(request.url).pathname; //pathname不包括参数
	if(req_path[1]==='-'){
		execCmd(req_path, request, response); //mokjs命令以/-开头
		return;
	}
	var host = request.headers.host;
	port==='80' || host.indexOf(':')>0 || (host += ':' + port);
	var routes = allRoutes[host] || [],
		i, len = routes.length,
		match, route;
	for(i = 0; i < len; i++){
		route = routes[i];
		match = req_path.match(route.regexp);
		if(match){ //console.log(match);
			if(route.project){
				var file = route.format ? route.format(match) : match[1] || match[0],
					prj_conf = CONF.projects[route.project];
				file[0]==='/' && (file = file.slice(1));
				if(prj_conf.type){ //css or html project
					require(prj_conf.type==='css'?'./moktext/css':'./moktext/html').output(file, prj_conf, response);
				}else if(testMin[route.project]){
					var build_path = prj_conf.build_path;
					build_path[build_path.length-1]==='/' || (build_path+='/');
					if(prj_conf.comb_mode){
						require('./mok_modules/mok_comb').comb(file, prj_conf, response);
					}else{
						outputFile(build_path+'min/'+file, '.js', response);
					}
				}else if(file===prj_conf.boot_js || (prj_conf.comb_mode && file.slice(3)==='boot.js')){
					var src_path = prj_conf.path;
					src_path[src_path.length-1]==='/' || (src_path+='/');
					outputFile(src_path+(prj_conf.boot_js||'boot.js'), '.js', response);
				}else{
					outputJs(file, prj_conf, response);
				}
			}else{
				route.locate ? outputFile(route.locate(match), PATH.extname(req_path).toLowerCase(), response)
					: route.handler(match, request, response, req_path);
			}
			return;
		}
	}
	if(req_path==='/favicon.ico'){
		outputFile('./common/favicon.ico', '.ico', response);
	}else{
		require('./mok_modules/mok_break_host').request(request, response); //突破host请求线上资源
	}
}

function execCmd(req_path, request, response){
	//构建项目、生成文档、查看模块等命令
	response.writeHead(200, {'Content-Type':'text/html','Cache-Control':'max-age=5'});
	var argv = parseArgv(req_path.slice(2).split('-')),
		prj = argv._prj, prj_conf = CONF.projects[prj];
	if(!prj||!prj_conf){
		response.end(global.HEAD_HTML.replace('{{title}}', '无效的项目名')+
			'无效的项目名：'+prj+
			'。请在 __config.js 里检查是否有该项目的配置。</body></html>');
		return;
	}
	
	var cmd = argv._cmd;
	if(cmd==='b' || cmd==='build'){ //打包压缩
		if(prj_conf.comb_mode){
			require('./mok-js/build_comb').build(argv, prj_conf, response);
			return;
		}
		var type = prj_conf.type;
		if(type){
			type==='html' || type==='css' || (type = false);
		}
		require(type?'./moktext/'+type:'./mok-js/build').build(argv, prj_conf, response);
	
	}else if(cmd==='min'){ //切换压缩文件模式
		if(prj_conf.type==='css'){
			require('./moktext/css').testMin(prj_conf, response);
			return;
		}
		testMin[prj] = !!prj_conf.__hasbuilt && !testMin[prj];
		response.write(global.HEAD_HTML.replace('{{title}}', '切换测试JS压缩文件模式'));
		prj_conf.__hasbuilt ? response.end('已 <b>'+ (testMin[prj]?'<em>切换到</em>':'取消') +
			'</b> 测试JS压缩文件模式。</body></html>') :
			response.end('未构建项目，<b>不能切换到</b> 测试JS压缩文件模式。<br/>'+
				'另：修改配置文件后需要重新构建项目。</body></html>');
		prj_conf.comb_mode && testMin[prj] &&
			require('./mok_modules/mok_comb').testVersion(prj_conf);
	
	}else if(cmd==='d' || cmd==='doc'){ //生成文档
		require('./mokdoc/main').main(argv, prj_conf, response);
	}else{
		var extcmd = require('./mok_modules/mok_extend_cmd')[cmd];
		if(extcmd){
			extcmd(argv, prj_conf, response);
		}else{
			response.end(global.HEAD_HTML.replace('{{title}}', '命令错误')+
				'命令错误，<a href="http://mokjs.com/start.html" '+
				'target="_blank">点击这里</a> 查看mokjs的所有内建命令。</body></html>');
		}
	}
}

function outputFile(file, file_ext, response){
	if(FS.existsSync(file)){
		FS.readFile(file, 'binary', function(err, filedata){
			if(err){
				response.writeHead(500, {'Content-Type':'text/plain'});
				response.end('MOKJS-500: Read file error. Maybe ['+file+'] is not a file. \n'+err.toString());
			}else{
				response.writeHead(200, {
					'Cache-Control': 'no-cache,max-age=0',
					'Content-Type': MIME[file_ext] || 'unknown'
				});
				response.write(filedata, 'binary');
				response.end();
			}
		});
	}else{
		response.writeHead(404, {'Content-Type':'text/plain'});
		response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
	}
}

//解析命令参数
function parseArgv(args){
	var i = args.length, j, arg,
		argv = {_prj:args[0], _cmd:(args[1]||'-').toLowerCase()};
	while(i-- > 2){
		arg = args[i];
		j = arg.indexOf('=');
		if(j>0){
			argv[arg.slice(0, j)] = arg.slice(j+1);
		}else{
			argv[arg] = '';
		}
	}
	return argv;
}

process.on('uncaughtException', function(err){ //捕获漏网的异常
	console.error('\nMOKJS Uncaught Exception: ' + err.stack);
});

//启动服务
~function(routes, default_port){
	var HTTP = require('http');
	var rs = Object.keys(routes),
		ports = [], x, listen = {};

	rs.unshift(default_port);
	for(var i = 0, l = rs.length; i < l; i++){
		x = rs[i].split(':')[1]; //不用考虑下标越界
		if(x){
			if(!listen.hasOwnProperty(x)){
				listen[x] = true;
				ports.push(x);
				~function(port){
					//！注意，端口被占用时，会抛出异常：Error: listen EADDRINUSE
					HTTP.createServer(function(request, response){
						onRequest(request, response, port);
					}).listen(port);
				}(x);
			}
			if(x==='80' && i){ //去掉80端口的端口号，因为80端口时request.headers.host没有':80'
				x = rs[i];
				routes[x.slice(0,-3)] = routes[x];
				routes[x] = null;
			}
		}else if(default_port!==':80'){
			x = rs[i];
			routes[x+default_port] = routes[x];
			routes[x] = null;
		}
	}
	console.log('MOKJS is running at host 127.0.0.1, listening port(s): '+ports.join(', ')+'.');
}(allRoutes, ':'+CONF.http_port);

CONF.proxy_conf && require('./mok_modules/mok_proxy').main(CONF.proxy_conf);
