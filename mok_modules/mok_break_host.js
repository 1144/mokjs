	/*--
		突破本地host请求线上或其他主机资源
		将某个域名指向本地127.0.0.1后，该域名下的所有请求都会指向本地服务器，
		但是本地又可能没有对应的资源，这时候可以用此模块请求线上、或指定主机IP、
		或指定端口的资源。
		-author hahaboy
	*/
	var fs = require('fs'),
		dns = require('dns'),
		http = require('http');

	function doRequest(request, response, host, port) {
		//console.log(request.url, host, port);
		var options = {
			headers: request.headers,
			hostname: host,
			port: port || '80',
			method: request.method,
			path: request.url
		};
		var req = http.request(options, function (res) {
			//console.log('http.request...');
			response.writeHeader(res.statusCode, res.headers);
			res.pipe(response);
		});
		req.on('error', function (err) {
			response.writeHeader(500, {'Content-Type':'text/plain'});
			response.write('Request URL: ' + request.url);
			response.end('\nBreak Host Error: ' + err.message);
		});
		request.pipe(req);
	}

	var host_cache = {}, exp_time = 0;
	//请求非本机内容
	//host_port 请求的域名和端口，例如 'a.com:8080'，'10.58.101.31:80'
	//host_port可以只有host或只有端口号，例如 'a.com'，':8080'
	exports.request = function (request, response, host_port) {
		//console.log(request.headers.host)
		var hp = (request.headers.host || '').split(':');
		if (host_port) {
			host_port = host_port.split(':');
			if (host_port[0]) {
				doRequest(request, response, host_port[0], host_port[1] || hp[1]);
				return;
			}
			hp[1] = host_port[1];
		}
		var host = hp[0];
		if (exp_time < Date.now()) {
			host_cache = {}; //清空缓存
			exp_time = Date.now() + 900000; //host缓存15分钟（900000ms）
		}
		if (host_cache.hasOwnProperty(host)) {
			doRequest(request, response, host_cache[host], hp[1]);
			return;
		}
		dns.resolve4(host, function (err, addresses) { //console.log('resolve4: '+host);
			if (err) {
				response.writeHeader(404, {'Content-Type':'text/plain'});
				response.write('Request URL: ' + request.url);
				response.end('\nBreak Host Error: ' + err.message);
			} else {
				doRequest(request, response, host_cache[host] = addresses[0], hp[1]);
			}
		});
	};
