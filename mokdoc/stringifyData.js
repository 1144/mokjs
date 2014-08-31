
	var kw = ('abstract boolean break byte case catch char class const continue debugger default delete do double'+
	' else enum export extends false final finally float for function goto var void volatile while with'+
	' if implements import in instanceof int interface long native new null package private protected public'+
	' return short static super switch synchronized this throw throws transient true try typeof').split(' ');
	var j = kw.length, jskw = {};
	while(j--){
		jskw[kw[j]] = true;
	}
	kw = null;

	var undef, reg_rep = /[\n\t\r\"\\]/g,
		rep = {'\r':'\\r', '\n':'\\n', '\t':'\\t', '"':'\\"', '\\':'\\\\'};
	/*--
		将提取出的注释数据字符串化。
		因为数据的值类型只有字符串或数组，或其他一些基本类型，所以字符串化起来比较简单。
	*/
	function stringify(data){
		switch(typeof data){
			case 'string':
				return '"'+ data.replace(reg_rep, function(a){
					return rep[a];
				}) +'"';
			
			case 'object':
				if(data===null){return 'null'}
				var res = [], k, v;
				if(data instanceof Array){
					var l = data.length;
					for(k = 0; k < l; k++){
						v = stringify(data[k]);
						v===undef || res.push(v);
					}
					return '['+ res.join(',') +']';
				}else{
					for(k in data){
						if(data.hasOwnProperty(k) && k){
							v = stringify(data[k]);
							jskw[k] && (k = '"'+k+'"');
							v===undef || res.push(k +':'+ v);
						}
					}
					return '{'+ res.join(',') +'}';
				}

			case 'number':
				return isFinite(data) ? data.toString() : 'null';
			
			case 'undefined':
			case 'unknown':
				return;
			case 'function':
			case 'boolean':
			case 'regexp':
				return data.toString();
		}
	}

	module.exports = stringify;
