/*--
	mokjs - 前端开发服务框架 - 模块JS
	-author hahaboy | @攻城氏
	-site http://mokjs.com/
*/
var url = require('url'),
	path = require('path'),
	fs = require('fs'),
	MIME = require('./common/mime'),
	CONF = require('./__config'),
	updateConf = true, //是否更新config
	mokjs = require('./mok-js/main'),
	allRoutes = CONF.routes,
	outputJs = mokjs.output,
	testMin = {}; //项目是否处于测试压缩文件模式

global.HEAD_HTML = fs.readFileSync(__dirname+'/common/head.html', 'utf8');
fixPrjConf(CONF.projects);

fs.watch(__dirname+'/__config.js', function (eventType) {
	if (updateConf && eventType==='change') { //防止重复触发
		require.cache[require.resolve('./__config')] = null;
		try {
			CONF = require('./__config');
			fixPrjConf(CONF.projects);
			allRoutes = CONF.routes;
			var t = new Date(),
				h = t.getHours(), m = t.getMinutes(), s = t.getSeconds();
			console.log('MOKJS-100: 配置更新成功！(Time: '+(h>9 ? h : '0'+h)+
				':'+(m>9 ? m : '0'+m)+':'+(s>9 ? s : '0'+s)+')');
		} catch (e) {
			console.log('MOKJS-101: 配置文件语法错误！\n'+e);
		}
		updateConf = false;
		setTimeout(function(){updateConf = true}, 200);
	}
});

function onRequest(request, response) {
	var req_path = url.parse(request.url).pathname; //pathname不包括参数
	if (req_path[1]==='-') {
		execCmd(req_path, request, response); //mokjs命令以/-开头
		return;
	}
	var host = request.$host || request.headers.host,
		port = request.$port;
	port==='80' || host.indexOf(':')>0 || (host += ':'+port);
	var routes = allRoutes[host] || [],
		i, len = routes.length,
		match, route;
	for (i = 0; i < len; i++) {
		route = routes[i];
		match = req_path.match(route.regexp);
		if (match) { //console.log(match);
			if (route.project) {
				var file = route.format ? route.format(match) : match[1] || match[0],
					prj_conf = CONF.projects[route.project];
				file[0]==='/' && (file = file.slice(1));
				if (prj_conf.type) { //css or html project
					require(prj_conf.type==='css' ? './moktext/css' :
						'./moktext/html').output(file, prj_conf, response);
				} else if (testMin[route.project]) {
					if (prj_conf.comb_mode) {
						require('./mok_modules/mok_comb').comb(file, prj_conf, response);
					} else {
						outputFile(prj_conf.build_path+'min/'+file, '.js', response);
					}
				} else if (file===prj_conf.boot_js ||
					(prj_conf.comb_mode && file.slice(3)==='boot.js')) {
					outputFile(prj_conf.path+(prj_conf.boot_js||'boot.js'), '.js', response);
				} else {
					outputJs(file, prj_conf, response);
				}
			} else {
				if (route.locate) {
					outputFile(route.locate(match), 
						path.extname(req_path).toLowerCase(), response);
				} else if (route.handler) {
					route.handler(match, request, response, onRequest);
				} else {
					route.root && staticServe(match, request, response, route);
				}
			}
			return;
		}
	}
	if (req_path==='/favicon.ico') {
		outputFile(__dirname+'/common/favicon.ico', '.ico', response);
	} else {
		//突破host请求线上资源
		require('./mok_modules/mok_break_host').request(request, response);
	}
}

function execCmd(req_path, request, response) {
	//构建项目、生成文档、查看模块等命令
	response.writeHead(200, {'Content-Type':'text/html','Cache-Control':'max-age=5'});
	var argv = parseArgv(req_path.slice(2).split('-')),
		prj = argv._prj, prj_conf = CONF.projects[prj];
	if (!prj || !prj_conf) {
		response.end(global.HEAD_HTML.replace('{{title}}', '无效的项目名')+
			'无效的项目名：'+prj+
			'。请在 __config.js 里检查是否有该项目的配置。</body></html>');
		return;
	}
	
	var cmd = argv._cmd;
	if (cmd==='b' || cmd==='build') { //打包压缩
		if (prj_conf.comb_mode) {
			require('./mok-js/build_comb').build(argv, prj_conf, response);
			return;
		}
		var type = prj_conf.type;
		if (type) {
			type==='html' || type==='css' || (type = false);
		}
		require(type?'./moktext/'+type:'./mok-js/build').build(argv, prj_conf, response);
	
	} else if (cmd==='min') { //切换压缩文件模式
		if (prj_conf.type === 'css') {
			require('./moktext/css').testMin(prj_conf, response);
			return;
		}
		testMin[prj] = !!prj_conf.__hasbuilt && !testMin[prj];
		response.write(global.HEAD_HTML.replace('{{title}}', '切换测试JS压缩文件模式'));
		if (prj_conf.__hasbuilt) {
			response.end('已 <b>'+(testMin[prj] ? '<em>切换到</em>' : '取消')+
				'</b> 测试JS压缩文件模式。</body></html>')
		} else {
			response.end('未构建项目，<b>不能切换到</b> 测试JS压缩文件模式。<br/>'+
				'另：修改配置文件后需要重新构建项目。</body></html>');
		}
		prj_conf.comb_mode && testMin[prj] &&
			require('./mok_modules/mok_comb').testVersion(prj_conf);
	
	} else {
		var extcmd = require('./mok_modules/mok_extend_cmd')[cmd];
		if (extcmd) {
			extcmd(argv, prj_conf, response);
		} else {
			response.end(global.HEAD_HTML.replace('{{title}}', '命令错误')+
				'命令错误，<a href="http://mokjs.com/start.html" '+
				'target="_blank">点击这里</a> 查看mokjs的所有内建命令。</body></html>');
		}
	}
}

function outputFile(file, file_ext, response) {
	if (fs.existsSync(file)) {
		if (fs.statSync(file).isFile()) {
			response.writeHead(200, {
				'Cache-Control': 'no-cache,max-age=0',
				'Content-Type': MIME[file_ext] || 'unknown'
			});
			fs.createReadStream(file).pipe(response);
		} else {
			response.writeHead(500, {'Content-Type':'text/plain'});
			response.end('MOKJS-500: Read file error. ['+file+'] is not a file.');
		}
	} else {
		response.writeHead(404, {'Content-Type':'text/plain'});
		response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
	}
}

function staticServe(match, request, response, route) {
	var root = route.root;
	if (fs.existsSync(root)) {
		var filename = decodeURI(route.format ? route.format(match) : match[1] || match[0]);
		filename[0]==='/' && (filename = filename.slice(1));
		var file = root.slice(-1)==='/' ? root+filename : root+'/'+filename;
		//console.log(root, file);
		if (fs.existsSync(file)) {
			if (fs.statSync(file).isFile()) { //file
				response.writeHead(200, {
					'Cache-Control': 'no-cache,max-age=0',
					'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'unknown'
				});
				fs.createReadStream(file).pipe(response);
			} else { //directory
				response.writeHead(200, {
					'Cache-Control': 'no-cache,max-age=0',
					'Content-Type': 'text/html'
				});
				response.write(global.HEAD_HTML.replace('{{title}}', '浏览目录 '+file));
				var dir = filename.slice(-1)==='/' ? filename.slice(0, -1) : filename;
				if (dir) {
					response.write('<a href="/'+dir.slice(0, dir.lastIndexOf('/')+1)+
						'">返回上一级</a><hr/>');
					dir += '/';
				}
				fs.readdirSync(file).forEach(function (f) {
					response.write('<a href="/'+dir+f+'">'+f+'</a><br/>');
				});
				response.end('</body></html>');
			}
			return;
		}
	}
	response.writeHead(404, {'Content-Type':'text/plain'});
	response.end('MOKJS-404: Not found. Wrong path ['+file+'].');
}

//解析命令参数
function parseArgv(args) {
	var i = args.length, j, arg,
		argv = {_prj:args[0], _cmd:(args[1] || '-').toLowerCase()};
	while (i-- > 2) {
		arg = args[i];
		j = arg.indexOf('=');
		if (j>0) {
			argv[arg.slice(0, j)] = arg.slice(j + 1);
		} else {
			argv[arg] = arg; //没有参数值的，以参数名作为参数值
		}
	}
	return argv;
}

//修正项目配置：1、路径后加反斜线；2、默认编码使用utf8
function fixPrjConf(projects) {
	var p, conf;
	for (p in projects) {
		conf = projects[p];
		conf.path && conf.path.slice(-1)!=='/' && (conf.path += '/');
		conf.build_path && conf.build_path.slice(-1)!=='/' && (conf.build_path += '/');
		conf.charset || (conf.charset = 'utf8');
	}
}

//创建服务器
~function (routes, default_port) {
	var http = require('http');
	var rs = Object.keys(routes),
		ports = [],
		listen = {},
		x;

	rs.unshift(default_port);
	for (var i = 0, l = rs.length; i < l; i++) {
		x = rs[i].split(':')[1]; //不用考虑下标越界
		if (x) {
			if (!listen.hasOwnProperty(x)) {
				listen[x] = true;
				ports.push(x);
				~function (port) {
					//！注意，端口被占用时，会抛出异常：Error: listen EADDRINUSE
					http.createServer(function (request, response) {
						request.$port = port;
						onRequest(request, response);
					}).listen(port);
				}(x);
			}
			if (x==='80' && i) {
				//去掉80端口的端口号，因为80端口时request.headers.host没有':80'
				x = rs[i];
				routes[x.slice(0, -3)] = routes[x];
				routes[x] = null;
			}
		} else if (default_port!==':80') {
			x = rs[i];
			routes[x+default_port] = routes[x];
			routes[x] = null;
		}
	}
	if (CONF.https_routes) {
		ports.push('443(https)');
		for (x in CONF.https_routes){
			routes[x] = CONF.https_routes[x];
		}
		require('https').createServer({
			key: fs.readFileSync('./common/ssl/privatekey.pem'),
			cert: fs.readFileSync('./common/ssl/certificate.pem')
		}, function (request, response) {
			request.$port = '80';
			onRequest(request, response);
		}).listen(443);
	}
	console.log('\033[1m\033[32mMOKJS is running at this host, listening on port(s): '+
		ports.join(', ')+'.\033[0m');
}(allRoutes, ':'+CONF.http_port);

CONF.proxy_conf && require('./mok_modules/mok_proxy').start(CONF.proxy_conf);

process.on('uncaughtException', function (ex) { //捕获漏网的异常
	console.error('\nMOKJS Uncaught Exception: '+ex.stack);
});
