	/*--
		反向代理插件
		将某个host指向本地127.0.0.1后，该host下的所有请求都会指向本地服务器，
		但是本地又可能没有对应的资源，这时候可以用这个代理请求线上、或指定IP、
		或指定端口的资源。
		-author hahaboy
	*/
	var FS = require('fs'),
		DNS = require('dns'),
		HTTP = require('http');

	function doRequest(request, response, host, port){
		//console.log(request.url);
		var options = {
			headers: request.headers,
			hostname: host,
			port: port || '80',
			method: request.method,
			path: request.url
		};
		var req = HTTP.request(options, function(res){
			response.writeHeader(res.statusCode, res.headers);
			res.on('data', function(chunk){
				response.write(chunk);
			});
			res.on('end', function(){
				response.end();
			});
		});
		req.on('error', function(err){
			response.writeHeader(500, {'Content-Type':'text/plain'});
			response.write('Request URL: ' + request.url);
			response.end('\nMOKJS Proxy Error: ' + err.message);
		});
		request.on('data', function(data){
			req.write(data);
		}).on('end', function(){
			req.end(); //console.log('req data end.');
		});
	}

	var host_cache = {}, exp_time = 0;
	//请求非本机内容
	//host_port 请求的域名和端口，例如 a.com:8080，10.58.101.31:80
	exports.request = function(request, response, host_port){ //console.log(request.headers.host)
		if(host_port){
			host_port = host_port.split(':');
			doRequest(request, response, host_port[0], host_port[1]);
			return;
		}
		var hp = request.headers.host.split(':'), host = hp[0];
		if(exp_time < Date.now()){
			host_cache = {}; //清空缓存
			exp_time = Date.now() + 900000; //host缓存15分钟（900000ms）
			//console.log('cache exp..');
		}
		if(host_cache.hasOwnProperty(host)){
			doRequest(request, response, host_cache[host], hp[1]);
			return;
		}
		DNS.resolve4(host, function(err, addresses){ //console.log('resolve4: '+host);
			if(err){
				response.writeHeader(404, {'Content-Type':'text/plain'});
				response.write('Request URL: ' + request.url);
				response.end('\nMOKJS Proxy Error: ' + err.message);
			}else{
				doRequest(request, response, host_cache[host] = addresses[0], hp[1]);
			}
		});
	};
