/* run in the browser */
var mokjs = {
	setCookie: function (name, value) {
		var t = new Date();
		t.setTime(t.getTime() + 5184000000); //two months: 2*30*24*60*60*1000
		document.cookie = name+'='+escape(value)+';path=/;expires='+t.toGMTString();
	},
	getCookie: function (name) {
		name += '=';
		var c = document.cookie, val = '', nl = name.length;
		if (c) {
			c = c.replace(/\s/g, '').split(';');
			var i = c.length;
			while (i--) {
				if (c[i].slice(0, nl)===name) {
					val = unescape(c[i].slice(nl));
					break;
				}
			}
		}
		return val;
	}
};

!function () {
	var el = document.getElementById('searched'),
		prj = el.getAttribute('data-project'),
		ms = mokjs.getCookie(prj),
		m = window.module,
		i;
	if (ms) {
		ms = ms.split(',');
		i = ms.length;
		var cmd = window.location.href.split('/-')[0]+'/-'+prj+'-m-', html = '最近查看：', mi;
		while (i--) {
			mi = ms[i];
			if (mi===m) {
				ms.splice(i, 1);
				continue;
			}
			html += '<a class="a20" href="'+cmd+mi+'">'+mi+'</a>';
		}
		el.innerHTML = html;
		el.className = 'src';
	} else {
		ms = [];
	}
	if (m) {
		ms.push(m);
		ms.length>15 && ms.shift(0);
		mokjs.setCookie(prj, ms.join(','));
	}
}();
