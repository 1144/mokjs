var proxy_port = parseInt(process.argv[2], 10);
if (!proxy_port || proxy_port<0) {
	console.log('invalid port: '+proxy_port);
	return;
}
var port_conf = (require('../__config').proxy2_conf || {})[proxy_port];
if (!port_conf) {
	console.log('no config, invalid port: '+proxy_port);
	return;
}

var net = require('net');
var trace = require('../common/trace');

//连接两个buffer
function concatBuffer(buf1, buf2) {
	var buf1Len = buf1.length,
		res = new Buffer(buf1Len + buf2.length);
	buf1.copy(res);
	buf2.copy(res, buf1Len);
	return res;
}

//'\r\n\r\n'分开head和body
function findBody(data) {
	var i = data.length;
	while (i-- && i>10) { //10都算少的了
		if (data[i]===0x0a && data[i-2]===0x0a &&
			data[i-1]===0x0d && data[i-3]===0x0d) {
			return i + 1;
		}
	}
	return -1;
}

//CONNECT {method:'CONNECT', host, port}
//GET/POST {metod, host, port, path, head, data}
function parseRequestOption(data, pos, conf) {
	var header_str = data.slice(0, pos).toString('utf8');
	var method = header_str.split(' ', 1)[0], info, opt;
	if (method==='CONNECT') {
		info = header_str.match(/^[A-Z]+\s([^:\s]+):(\d+)\sHTTP/);
		if (info) {
			opt = {method: 'CONNECT', host: info[1], port: info[2]};
			if (conf[info[1]]) {
				var o = conf[info[1]][0].transfer(opt);
				o.host && (opt.host = o.host);
				o.port && (opt.port = o.port);
			}
			return opt;
		}
	} else {
		info = header_str.match(/^[A-Z]+\s(\S+)\sHTTP\/(\d\.\d)/);
		if (info) {
			var host = header_str.match(/Host:\s([^\n\s\r]+)/)[1];
			if (host) {
				var hp = host.split(':'),
					path = info[1].replace(/^http:\/\/[^\/]+/, ''),
					ri = header_str.indexOf('\r'),
					hd1 = header_str.slice(0, ri),
					hd2 = header_str.slice(ri);

				hd2 = hd2.replace(/Proxy-Connection:.+\r\n/ig, '')
					.replace(/Keep-Alive:.+\r\n/i, '')
					.replace('\r\n', '\r\nConnection: close\r\n');
				opt = {
					method: method,
					host: hp[0],
					port: hp[1] || '80',
					path: path,
					http_version: info[2],
					data: data.slice(pos)
				};

				if (conf[hp[0]]) {
					var routes = conf[hp[0]],
						i = 0, len = routes.length,
						route, match;
					for (; i < len; i++) {
						route = routes[i];
						match = path.match(route.regexp);
						if (match) {
							var o = (route.transfer || route.replace)(opt, match);
							if (o.host) {
								opt.host = o.host;
								if (route.replace) {
									hd2 = hd2.replace('Host: '+host,
										'Host: '+o.host+
										(o.port ? (o.port=='80' ? '' : ':'+o.port) :
											hp[1] || '')+'\r\nsrchost: '+host);
								}
							}
							o.port && (opt.port = o.port);
							o.path && (opt.path = o.path[0]==='/' ? o.path : '/'+o.path);
							o.data && (opt.data = o.data);
							if (info[2]!=='1.1') {
								if (route.replace) {
									opt.path = 'http://'+opt.host+
										(opt.port=='80' ? '' : ':'+opt.port)+opt.path;
								} else {
									opt.path = 'http://'+host+opt.path;
								}
							}
							opt.headers = method+' '+opt.path+' HTTP/'+info[2]+hd2;
							return opt;
						}
					}
				}

				opt.headers = method+' '+info[1]+' HTTP/'+info[2]+hd2;
				return opt;
			}
		}
	}
	return null;
}

function relayConnection(opt, client) {
	//console.log(opt.host, opt.port);
	var server = net.createConnection(opt.port, opt.host);
	server.pipe(client);
	server.on('error', function (err) {
		trace.warn('Proxy2 error on request: '+opt.host+':'+opt.port+' '+(opt.path||''));
		//trace.error(err);
		client.destroy();
	});

	client.pipe(server);
	client.on('error', function () {
		server.destroy();
	});

	if (opt.method==='CONNECT') {
		client.write(new Buffer('HTTP/1.1 200 Connection established\r\n'+
			'Connection: close\r\n\r\n'));
	} else {
		server.write(new Buffer(opt.headers, 'utf8'));
		server.write(opt.data);
	}
}

//create proxy server
var cp_exec = require('child_process').exec;
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

var sockServer = net.createServer(function (client) {
	var datas;
	client.on('data', function (data) {
		if (datas) { //大部分请求都只触发一次data事件
			datas = concatBuffer(datas, data);
		} else {
			datas = data;
		}
		var pos = findBody(datas);
		if (pos===-1) {return}
		var request_option = parseRequestOption(datas, pos, port_conf);
		if (request_option===null) {return}
		client.removeAllListeners('data');
		relayConnection(request_option, client);
	});
});

sockServer.on('listening', function () {
	trace.ok('Proxy2 is listening on port '+proxy_port+'.');
});

if (cluster.isMaster) {
	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
	if (1==numCPUs) {
		cluster.fork(); //make sure it is more than 2
	}
	cluster.on('exit', function (worker, code, signal) {
		if (worker.suicide!==true) {
			cp_exec('taskkill /pid '+worker.process.pid+' /T /F');
		}
	});
} else {
	sockServer.listen(proxy_port);
}

process.on('uncaughtException', function (ex) {
	trace.error('\nProxy2 Uncaught Exception:\n'+ex);
});
