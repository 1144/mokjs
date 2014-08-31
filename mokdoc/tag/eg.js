
exports.tag = {
	multiple: false,
	handler: function(cmd, data, doc){
		var reg_blank = /^ */, reg_4blank = /    /g,
			default_num = (data[1] || '').replace(/\t/g, '    ').match(reg_blank)[0].length,
			i = 1,
			l = data.length,
			code = [], line, num;

		for(; i < l; i++){
			line = data[i].replace(/\t/g, '    ');
			if(default_num>0){
				//根据第1行前导空格数删除后续代码的前导空格
				num = line.match(reg_blank)[0].length;
				code.push(line.slice(default_num<num ? default_num : num
					).replace(reg_4blank, '\t'));
			}else{
				code.push(line.replace(reg_4blank, '\t'));
			}
		}
		return code.join('\n');
	}
};
