var config = {
    env: "prod",
};
(
    // 根据不同的环境初始化参数
    function () {
        switch (config.env) {
            // 开发环境
            case "dev":
                config.root = "http://127.0.0.1:9233";
                config.rootResource = "http://127.0.0.1:9235";
                break;
            // 默认为正式生产环境
            default:
                config.root = 'https://pay.calltalent.cn/api';
                config.rootResource = 'https://resource.calltalent.cn/api';
                break;
        }
    }
)()

var AJAX = new function () {
    var _xhr,
        K = "_token",
        abs = null,
        t = this;
    const signField = 'qk_sign',
        signKey = 'qkA*SX&v4%!su$aLGwF',
        signNonce = 'nonce_str';

    function finish(v, cb) {
        if (cb == null) return;
        var o;
        if (v && v.length > 1) {
            try {
                o = JSON.parse(v);
            } catch (e) {
                o = v;
            }
        }
        if (o && o.code < 0) {
            Comm.message(o.msg);
        }
        if (o && o.code === 403) {
            Comm.msg("登录已过期，请重新登录", 5);
            return;
        }
        cb(o);
    }

    function ab() {
        // if (abs == null) {
        //     abs = top.Comm.db(K);
        //     if (abs == null) abs = "";
        // }
        return abs;
    }

    function repair(api, timespan) {
        api += (api.indexOf("?") > 0 ? "&" : "?") + "timespan=" + timespan;
        return api;
    }

    function deobj(obj, url) {
        if (obj == null) return "";
        let s = [];
        let data = {};
        // 如果传入了url，那么就从url中解析参数，如果有则用于加密（在设置参数名称时禁止重名，否则会被覆盖
        if (url) urlParame(url, data);

        for (let i in obj) {
            if (typeof obj[i] == typeof "") {
                if (obj[i].indexOf("%") > 0) obj[i] = obj[i].replace(/%/g, "%25");
                if (obj[i].indexOf("&") > 0) obj[i] = obj[i].replace(/\&/g, "%26");
                if (obj[i].indexOf("+") > 0) obj[i] = obj[i].replace(/\+/g, "%2B");
            }
            if (obj[i] || typeof obj[i] === "number") {
                s.push(i + "=" + encodeURIComponent(obj[i]));
                data[i] = obj[i];
            }
        }

        // 参数数据加密处理
        // 仅可校验非body参数，因为body参数在后端仅可被读取一次，重复读取将会抛异常，所以无法加密的，而且body还可能是二进制文件，是不方便加密和重复读取的，流的特性只可被读取一次
        s.push(signField + "=" + generateSignature(data))

        return s.join("&");
    }

    /**
     * 从url中解析参数并追加到已有参数对象中
     */
    function urlParame(url, param) {
        let index = url.indexOf("?");
        if (index !== -1) {
            let str = url.substring(index + 1)
            if (str) {
                if (param == null) param = {};
                str.split("&").forEach(v => {
                    let o = v.split("=");
                    param[o[0]] = o[1];
                })
            }
        }

        return param
    }

    /**
     * 生成签名
     *
     * @param data json格式数据
     * @returns {string}
     */
    function generateSignature(data) {
        let keyArray = [];
        $.each(data, key => {
            keyArray.push(key)
        })

        keyArray = keyArray.sort();
        let sb = "";
        $.each(keyArray, i => {
            let k = keyArray[i];
            if (k === signField) {
                return true;
            }
            let val = (data[k] || typeof data[k] === "number") ? String(data[k]).trim() : null;
            if (val) {
                sb += (k + '=' + val + '&');
            }
        })
        sb += ('key=' + signKey);

        return MD5.md5(sb).toUpperCase();
    }

    function error(code, cb) {
        cb && cb({code: -1, msg: "服务器异常"});
    }

    /**
     * 初始化请求操作
     * @param method
     * @param url
     * @param data 规定data为json格式
     * @param body body传参，规定post请求，json格式
     * @param cb
     * @param asyn
     */
    function init(method, url, data, body, cb, asyn) {
        let timespan = new Date().getTime();
        url = t.Uri() + repair(url, timespan);
        let xhrMethod = ("BODY" === method ? "POST" : method);
        if (asyn == null) asyn = true;
        if (body == null) body = {};
        data = (data == null) ? {} : data;
        data[signNonce] = Comm.uuid();

        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    finish(this.responseText, cb);
                } else {
                    error(this.status, cb);
                }
            }
        };

        let ag = ab();
        if ("GET" === method) {
            data = deobj(data, url);
            url += (url.indexOf("?") === -1 ? "?" : "&") + data;
            data = null;

            xhr.open(xhrMethod, url, asyn);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        } else if ("BODY" === method) {
            data = deobj(data, url);
            url += (url.indexOf("?") === -1 ? "?" : "&") + data;
            data = JSON.stringify(body);

            xhr.open(xhrMethod, url, asyn);
            xhr.setRequestHeader("Content-Type", "application/json");
        } else {
            data = deobj(data, url);

            xhr.open(xhrMethod, url, asyn);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        }

        xhr.send(data);
    }

    /*----AJAX公用方法-----*/

    /* 支持的请求方式 */
    t.SUPPORT = {
        GET: 'GET',
        POST: 'POST',
        BODY: 'BODY',
        DELETE: 'DELETE',
        PUT: 'PUT',
    }

    /*获取服务器接口根路径*/
    t.Uri = function () {
        return window["config"] && window["config"]["root"] ? config.root : "";
    };

    /*自定义初始化，一般用于框架内的组件调用，如：table，因为无法确认使用post还是get所以需要手动在组件内初始化，其他类似的也是这个道理*/
    t.INIT = function (method, url, data, body, cb, asyn) {
        init(method, url, data, body, cb, asyn);
    };
    /*执行GET方法，一般用于从服务器获取数据，api长度尽量不超过1000字节*/
    t.GET = function (api, data, cb, asyn) {
        init(t.SUPPORT.GET, api, data, null, cb, asyn);
    };
    /*执行POST方法，一般用于向服务器提交数据，data建议不为空*/
    t.POST = function (api, data, cb, asyn) {
        init(t.SUPPORT.POST, api, data, null, cb, asyn);
    };
    /*执行POST BODY传参，data建议不为空*/
    t.BODY = function (api, data, body, cb, asyn) {
        init(t.SUPPORT.BODY, api, data, body, cb, asyn);
    };
    /*执行DELETE方法*/
    t.DELETE = function (api, data, cb, asyn) {
        init(t.SUPPORT.DELETE, api, data, null, cb, asyn);
    };
    /*执行PUT方法，一般用于向服务器提交数据，data建议不为空*/
    t.PUT = function (api, data, cb, asyn) {
        init(t.SUPPORT.PUT, api, data, null, cb, asyn);
    };
}();
/**
 * 资源管理系统
 */
var AJAX_RESOURCE = new function () {
    var _xhr,
        K = "_token",
        abs = null,
        t = this;
    const signField = 'sign',
        signKey = 'yv@^$aoWDUw17+XTDe',
        signNonce = 'nonce_str';

    function finish(v, cb) {
        if (cb == null) return;
        var o;
        if (v && v.length > 1) {
            try {
                o = JSON.parse(v);
            } catch (e) {
                o = v;
            }
        }
        if (o && o.code < 0) {
            Comm.message(o.msg);
        }
        if (o && o.code === 403) {
            Comm.msg("登录已过期，请重新登录", 5);
            return;
        }
        cb(o);
    }

    function ab() {
        // if (abs == null) {
        //     abs = top.Comm.db(K);
        //     if (abs == null) abs = "";
        // }
        return abs;
    }

    function repair(api) {
        api += (api.indexOf("?") > 0 ? "&" : "?") + "timespan=" + new Date().getTime();
        return api;
    }

    function deobj(obj, url) {
        if (obj == null) return "";
        let s = [];
        let data = {};
        // 如果传入了url，那么就从url中解析参数，如果有则用于加密（在设置参数名称时禁止重名，否则会被覆盖
        if (url) urlParame(url, data);

        for (let i in obj) {
            if (typeof obj[i] == typeof "") {
                if (obj[i].indexOf("%") > 0) obj[i] = obj[i].replace(/%/g, "%25");
                if (obj[i].indexOf("&") > 0) obj[i] = obj[i].replace(/\&/g, "%26");
                if (obj[i].indexOf("+") > 0) obj[i] = obj[i].replace(/\+/g, "%2B");
            }
            if (obj[i] || typeof obj[i] === "number") {
                s.push(i + "=" + encodeURIComponent(obj[i]));
                data[i] = obj[i];
            }
        }

        // 参数数据加密处理
        // 仅可校验非body参数，因为body参数在后端仅可被读取一次，重复读取将会抛异常，所以无法加密的，而且body还可能是二进制文件，是不方便加密和重复读取的，流的特性只可被读取一次
        s.push(signField + "=" + generateSignature(data))

        return s.join("&");
    }

    /**
     * 从url中解析参数并追加到已有参数对象中
     */
    function urlParame(url, param) {
        let index = url.indexOf("?");
        if (index !== -1) {
            let str = url.substring(index + 1)
            if (str) {
                if (param == null) param = {};
                str.split("&").forEach(v => {
                    let o = v.split("=");
                    param[o[0]] = o[1];
                })
            }
        }

        return param
    }

    /**
     * 生成签名
     *
     * @param data json格式数据
     * @returns {string}
     */
    function generateSignature(data) {
        let keyArray = [];
        $.each(data, key => {
            keyArray.push(key)
        })

        keyArray = keyArray.sort();
        let sb = "";
        $.each(keyArray, i => {
            let k = keyArray[i];
            if (k === signField) {
                return true;
            }
            let val = (data[k] || typeof data[k] === "number") ? String(data[k]).trim() : null;
            if (val) {
                sb += (k + '=' + val + '&');
            }
        })
        sb += ('key=' + signKey);

        return MD5.md5(sb).toUpperCase();
    }

    function error(code, cb) {
        cb && cb({code: -1, msg: "服务器异常"});
    }

    /**
     * 初始化请求操作
     * @param method
     * @param url
     * @param data 规定data为json格式
     * @param body body传参，规定post请求，json格式
     * @param cb
     * @param asyn
     */
    function init(method, url, data, body, cb, asyn) {
        url = t.Uri() + repair(url);
        let xhrMethod = ("BODY" === method ? "POST" : method);
        if (asyn == null) asyn = true;
        if (body == null) body = {};
        data = (data == null) ? {} : data;
        data[signNonce] = Comm.uuid();

        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    finish(this.responseText, cb);
                } else {
                    error(this.status, cb);
                }
            }
        };

        let ag = ab();
        if ("GET" === method) {
            data = deobj(data, url);
            url += (url.indexOf("?") === -1 ? "?" : "&") + data;
            data = null;

            xhr.open(xhrMethod, url, asyn);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        } else if ("BODY" === method) {
            data = deobj(data, url);
            url += (url.indexOf("?") === -1 ? "?" : "&") + data;
            data = JSON.stringify(body);

            xhr.open(xhrMethod, url, asyn);
            xhr.setRequestHeader("Content-Type", "application/json");
        } else {
            data = deobj(data, url);

            xhr.open(xhrMethod, url, asyn);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        }
        xhr.setRequestHeader("Authorization", ag ? "Bearer " + ag : "Basic SHVRZE4qYmJoOVNVVkhyOWw4Om1wJkJDbWZhYWdPemw4c3R+dmM=");
        // 添加业务相关的其他参数的请求头；若其他项目使用此框架移除下方公共通用的参数

        xhr.send(data);
    }

    /*----AJAX公用方法-----*/

    /* 支持的请求方式 */
    t.SUPPORT = {
        GET: 'GET',
        POST: 'POST',
        BODY: 'BODY',
        DELETE: 'DELETE',
        PUT: 'PUT',
    }

    /*获取服务器接口根路径*/
    t.Uri = function () {
        return config.rootResource;
    };

    /*自定义初始化，一般用于框架内的组件调用，如：table，因为无法确认使用post还是get所以需要手动在组件内初始化，其他类似的也是这个道理*/
    t.INIT = function (method, url, data, body, cb, asyn) {
        init(method, url, data, body, cb, asyn);
    };
    /*执行GET方法，一般用于从服务器获取数据，api长度尽量不超过1000字节*/
    t.GET = function (api, data, cb, asyn) {
        init(t.SUPPORT.GET, api, data, null, cb, asyn);
    };
    /*执行POST方法，一般用于向服务器提交数据，data建议不为空*/
    t.POST = function (api, data, cb, asyn) {
        init(t.SUPPORT.POST, api, data, null, cb, asyn);
    };
    /*执行POST BODY传参，data建议不为空*/
    t.BODY = function (api, data, body, cb, asyn) {
        init(t.SUPPORT.BODY, api, data, body, cb, asyn);
    };
    /*执行DELETE方法*/
    t.DELETE = function (api, data, cb, asyn) {
        init(t.SUPPORT.DELETE, api, data, null, cb, asyn);
    };
    /*执行PUT方法，一般用于向服务器提交数据，data建议不为空*/
    t.PUT = function (api, data, cb, asyn) {
        init(t.SUPPORT.PUT, api, data, null, cb, asyn);
    };
}();

var Comm = {
    // 生成uuid
    uuid: function uuid() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )
    },
    // json格式化输出到页面
    syntaxHighlight: function (json) {
        if (typeof json != 'string') {
            json = JSON.stringify(json, undefined, 2);
        }
        json = json.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    },
    checkPhone: function (phoneNum) {
        return /^1[0-9]{10}$/.test(phoneNum);//true
    },
    Cookie: {
        set: function (name, value) {
            document.cookie = name + "=" + escape(value);
        },
        get: function (name) {
            var arr,
                reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
            if ((arr = document.cookie.match(reg))) return unescape(arr[2]);
            else return "";
        }
    },
    parse: function (s) {
        var o;
        try {
            o = JSON.parse(s);
        } catch (e) {
            o = s;
        }
        return o;
    },
    deData: function (s) {
        if (s && s.indexOf("/") > -1) {
            s = decodeURIComponent(s.replace(/\//g, "%"));
        }
        return Comm.parse(s);
    },
    enData: function (o) {
        return encodeURIComponent(JSON.stringify(o)).replace(/\%/g, "/");
    },
    db: function (t, v) {
        if (v == null) {
            if (arguments.length === 1) {
                return Comm.deData(Comm.Cookie.get(t));
            } else {
                Comm.Cookie.set(t, "");
            }
        } else {
            Comm.Cookie.set(t, Comm.enData(v));
        }
    },
};

/**
 * 日期格式化（原型扩展或重载）
 */
Date.prototype.format = function (fmt) {
    let o = {
        "M+": this.getMonth() + 1,                 //月份
        "d+": this.getDate(),                    //日
        "h+": this.getHours(),                   //小时
        "m+": this.getMinutes(),                 //分
        "s+": this.getSeconds(),                 //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (let k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}
