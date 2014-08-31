
//伪造response
exports.fakeResponse = {
	_fake_: true,
	writeHead: function(){},
	write: function(msg){
		//'\n' replace <br/>, '' replace <br />
		console.log(msg.replace(/<br\/>/g, '\n').replace(/<.+?>/g, ''));
	},
	end: function(msg){
		this.write(msg);
	}
};

//获取构建时间
exports.buildTime = function(){
	var t = new Date(),
		h = t.getHours(), m = t.getMinutes(), s = t.getSeconds();
	return ' (build time: '+(h>9 ? h : '0'+h)+':'+(m>9 ? m : '0'+m)+
		':'+(s>9 ? s : '0'+s)+')';
};

//重复str多少次，times次数
exports.repeat = function(str, times){
	var s = '';
	while(times--){
		s += str;
	}
	return s;
};

//处理JS相对路径
//p1已知路径，p2是相对于p1的路径，即要算出p2的绝对路径
exports.resolvePath = function(p1, p2){
	if(p2[0]==='.'){
		var a = p2.split('./'),
			l = a.length,
			b = p1.split('/').slice(0, a[0]==='' ? 1-l : -l);
		return b.length ? b.join('/')+'/'+a[l-1] : a[l-1];
	}
	return p2;
};

//处理HTML, CSS相对路径
//p1已知路径，p2是相对于p1的路径，即要算出p2的绝对路径
exports.resolveHCPath = function(p1, p2){
	if(p2[0]==='.'){
		var a = p2.split('./'), l = a.length,
		b = p1.split('/').slice(0,-l);
		return b.length ? b.join('/')+'/'+a[l-1] : a[l-1];
	}
	return p1.slice(0, p1.lastIndexOf('/')+1)+p2;
};

//载入模块简称
var prj = '', //项目路径
	mod_abbr = {},
	abbr_mod = {};
exports.loadModuleAbbr = function(prj_path){
	if(prj_path===prj){return}
	prj = prj_path;
	if(require('fs').existsSync(prj_path+'module_abbr.js')){
		abbr_mod = require(require('path').resolve(prj_path+'module_abbr'));
		mod_abbr = {};
		for(var k in abbr_mod){
			abbr_mod.hasOwnProperty(k) && (mod_abbr[abbr_mod[k]] = k);
		}
	}else{
		mod_abbr = {}, abbr_mod = {};
	}
};
exports.getModuleAbbr = function(modname){
	return mod_abbr[modname] || modname;
};

exports.parseRequire = function(line, srcfile){
	line = '!' + line;
	var req = 'require\n', ri = 0, j, c,
		i = 1, l = line.length,
		q = '', //存放单引号或双引号，为空则意味着不在字符串里
		r = '', m = '', ms = [];
	for(; i < l; i++){
		c = line[i];
		if(c==='"' || c==="'"){
			if(c===q && line[i-1]!=='\\'){ //字符串结束
				q = '';
				if(ri>7){ //收集模块结束
					if(m){
						if(abbr_mod[m]){ //是简称
							ms.push(abbr_mod[m]);
						}else{
							m = this.resolvePath(srcfile, m);
							ms.push(m);
							m = mod_abbr[m] || m;
						}
						//console.log(m);
						r += m;
					}
					m = '', ri = 0;
				}
			}else{
				q || (q = c); //q不存在 则字符串开始
			}
		}else if(q===''){ //不在字符串里
			if(c===req[ri]){
				j = i, ri++;
			}else if(ri>6){
				if(c==='('){
					ri = /[\w.$]/.test(line[j-7]) ? 0 : 8;
				}else if(c!==' ' && c!=='\t'){
					ri = 0;
				}
			}else if(c==='/' && line[i-1]==='/'){
				r += line.slice(i);
				break;
			}else{
				ri = 0;
			}
		}else if(ri>7){ //收集模块ing，btw 模块名不能包含单双引号！
			c===' '||c==='\t' ?
				console.log(srcfile+' 里引用的模块名包含空白字符！') : (m += c);
			continue;
		}
		r += c;
	} //console.log(r);
	return [r, ms];
};
