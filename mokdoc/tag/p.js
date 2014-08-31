var type_hash = {
	'str': 'string',
	'fn': 'function',
	'num': 'number',
	'obj': 'object',
	'reg': 'regexp',
	'date': 'date'
};
var reg_pro = /^<p>([\$\w]+)/;

exports.tag = {
	multiple: true,
	handler: function(cmd, data, doc){
		var l = cmd.length, name, opt, val, desc;
		if(l<3){return false}
		name = cmd[2];
		if(name[0]==='['){ //可选参数
			opt = true;
			var m = data[0].match(/\[(.+?)\]/);
			if(m){
				m = m[1].split('=');
				name = m[0].trim();
				if(m.length>1){
					val = m.slice(1).join('=').trim();
				}
			}else{
				return false;
			}
			desc = data[0].slice(data[0].indexOf(']')+1).replace(/^[\t ]+/, '') + this.stringify(data);
		}else{
			desc = cmd.slice(3).join(' ') + this.stringify(data);
		}
		data = {
			name: name,
			type: type_hash[cmd[1]] || cmd[1],
			desc: desc
		};
		if(opt){
			data.opt = 1;
			val && (data.val = val);
		}
		return data;
	},
	stringify: function(data){
		var res = '', i = 1, len = data.length, line;
		for(; i < len; i++){
			line = data[i].replace(/^[\t ]+/, '');
			res += (line[0]==='<' ? line.replace(reg_pro, '<p><b>$1</b>') : line);
		}
		return res;
	}
};
