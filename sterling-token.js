(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['sterling', 'async-arrays'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('sterling'), require('async-arrays'));
    } else {
        // Browser globals (root is window)
        root.Sterling.Token = factory(root.Sterling, root.AsyncArrays);
    }
}(this, function (Sterling, arrays) {
    //todo: cookie support
    var tokens = [];
    var gc = false;

    var SterlingToken =  {
        interval : 10000,
        serve : function(sterlingInstance, engine){
            var controls = {
                newTokenID : function(cb){
                    return cb(undefined, uuid.v4());
                },
                createToken : function(cb){
                    SterlingToken.newTokenID(function(err, id){
                        if(engine){
                            engine.set(id, cb);
                        }else{
                            tokens.push({
                                moment : Date.now(),
                                value : id
                            });
                            cb(id);
                        }

                    });
                },
                revokeToken : function(id, cb){
                    if(engine){
                        engine.unset(id, cb);
                    }else{
                        tokens = tokens.filter(function(item){
                            return item.value !== id;
                        });
                        cb();
                    }
                },
                validToken : function(id, cb){
                    if(engine){
                        engine.get(id, function(err, results){
                            cb(!!results[0]);
                        });
                    }else{
                        var results = tokens.filter(function(item){
                            return item.value === id;
                        });
                        cb(results.length == 1);
                    }
                }
            };
            if( (!engine) && (!gc) ){
                setInterval(function(){
                    var interval = SterlingToken.interval;
                    var now = Date.now();
                    tokens = tokens.filter(function(item){
                        return item.moment < now - interval;
                    });
                }, SterlingToken.interval/2)
            }
            var prefix = sterlingInstance.prefix || '';
            sterlingInstance.addTokenedRoute = function(route, handlers){
                var wrappedHandlers = {};
                Object.keys(handlers).forEach(function(method){
                    var handler = handlers[method];
                    wrappedHandlers[method] = function(token){
                        var args = Array.prototype.slice.call(arguments);
                        var ob = this;
                        /*controls.handleRequest(ob.res, ob.req, function(){
                            handler.apply(ob, args);
                        });*/
                        SterlingToken.validToken(token, function(valid){
                            if(valid){
                                handler.apply(ob, args);
                            }else{
                                ob.res.end(JSON.stringify({
                                    success: false
                                }));
                            }
                        });
                    }
                });
                sterlingInstance.addRoute(route, wrappedHandlers);
            }
            if(sterlingInstance.addSecureRoute){
                sterlingInstance.addSecureRoute(prefix+'/token/:session/new', {get:function(session){
                    var ob = this;
                    controls.createToken(token, function(id){
                        if(valid){
                            ob.res.end(JSON.stringify({
                                success: true,
                                token: id
                            }));
                        }else{
                            ob.res.end(JSON.stringify({
                                success: false
                            }));
                        }
                    });
                }});
            }
            sterlingInstance.addRoute(prefix+'/token/:token', {get:function(token){
                var ob = this;
                controls.validToken(token, function(valid){
                    if(valid){
                        ob.res.end(JSON.stringify({
                            success: true,
                            data: req.session
                        }));
                    }else{
                        ob.res.end(JSON.stringify({
                            success: false
                        }));
                    }
                });
            }});
            return controls;
        }
    };
    return SterlingToken;
}));
