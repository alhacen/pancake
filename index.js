class Realm{
    constructor(server){
        this.server = server;
        this.newUUID = () => this.server+Math.random()
        this.keyToPropMap = new Map()
        this.map = new Map()
        this.keyToTypeMap = new Map()
        this.idToCollectionMap = new Map()
    }
    define = (name, schema) =>{
        this.keyToPropMap.set(name,[])

        let keyToPropMap = this.keyToPropMap.get(name)

        Object.keys(schema).forEach(key=>{
            keyToPropMap.push(key)
            if(schema[key]==='string'){
                this.map.set(`${name}To${key}`,new Map())
                this.keyToTypeMap.set(`${name}To${key}`,'string')
            }
            else if(schema[key]==='array'){
                this.map.set(`${name}To${key}`,new Map())
                this.keyToTypeMap.set(`${name}To${key}`,'array')
            }else if(schema[key]==='*'){
                this.map.set(`${name}To${key}`,new Map())
                this.keyToTypeMap.set(`${name}To${key}`,'*')
            }else if(schema[key]==='*array'){
                // console.log('123')
                this.map.set(`${name}To${key}`,new Map())
                this.keyToTypeMap.set(`${name}To${key}`,'*array')
            }
            else{
                this.keyToPropMap.set(`${name}To${key}`,[])
                let keyToPropMap = this.keyToPropMap.get(`${name}To${key}`)                    
                Object.keys(schema[key]).forEach(subkey=>{
                    this.map.set(`${name}To${key}To${subkey}`,new Map())
                    keyToPropMap.push(subkey)
                    this.keyToTypeMap.set(`${name}To${key}To${subkey}`,'object')
                })
            }
        })
    }
    _resolvePointer = (pointersIdArray) =>{        
        return  pointersIdArray.map(pointersId=>{
            let newSelfObj={}
            let pointersCollection = this.idToCollectionMap.get(pointersId)
            if(!pointersId)
                return pointersId
            if(!pointersCollection)
                return pointersCollection
            this._resolveProps(newSelfObj, pointersCollection, pointersId)
            return newSelfObj
        })
    }
    _resolvePropsHelper = (id, key) =>{
        let pointersIdArray
        if(this.map.has(key)){                    
            switch(this.keyToTypeMap.get(key)){
                case 'string':
                case 'array':
                    return this.map.get(key).get(id)
                    break;
                case '*':
                case '*array':
                    pointersIdArray = this.map.get(key).get(id)
                    if(!Array.isArray(pointersIdArray))
                        return this._resolvePointer([pointersIdArray])[0]
                    else {
                        let res =  this._resolvePointer(pointersIdArray)
                        return new Proxy(res,{
                            get:(target, prop)=>{            
                                let actions={
                                    add: (...args) =>{
                                        pointersIdArray.push(...args)
                                    }
                                }
                                if(Object.keys(actions).includes(prop)){
                                    return actions[prop]
                                }else{
                                    return target[prop]
                                }
                            }
                        })
                        
                    }
                    
                    break;
            }
        }
    }
    _saveHandler = (id, key, payload) =>{
        // this.map.get(key).get(id).set()
        Object.keys(payload).forEach(payloadKey=>{
            // console.log(this.map.get(key+"To"+payloadKey).get())
            this.map.get(key+"To"+payloadKey).set(id,payload[payloadKey])
        })
    }
    _resolveProps = (selfObj, collection,id, key) =>{
        if(!key)
            key = collection

        let props = this.keyToPropMap.get(key)
        let tmpThis = this
        props.map(prop=>{
            Object.defineProperty(selfObj, prop, {
                get() { 
                    return tmpThis._resolvePropsHelper(id, key+"To"+prop)
                },
                set(payload){
                    tmpThis.map.get(key+"To"+prop).set(id,payload)
                },
               enumerable: true,
            })
            selfObj.save = (payload) =>{
                this._saveHandler(id, key, payload)
            }
        })
        
    }
    has = (id) => this.idToCollectionMap.has(id)
    collection = (collection) =>{
        let self ={}
        self.collection = collection

        self.has = (id) => this.idToCollectionMap.get(id) === self.collection

        self.id = (id) =>{
            let self2 = {}
            this._resolveProps(self2, collection, id)
            let res;
            self2.id = id
            
            self2.select = (key, self3)=>{
                let res;
                
                if(!self3)
                    self3 = {}
                if(!self3.collection)
                    self3.collection = self.collection
                if(!self3.id)
                    self3.id = self2.id
                if(self3.key)
                    self3.key = self3.key+'To'+key
                else
                    self3.key = self3.collection+'To'+key

                if(this.map.has(self3.key)){
                    
                    switch(this.keyToTypeMap.get(self3.key)){
                        case 'string':
                            res = this.map.get(self3.key).get(self3.id) 
                            self3.key = null                            
                            return res
                            break;
                        case '*':
                            let pointersId = this.map.get(self3.key).get(self3.id)
                            let pointersCollection = this.idToCollectionMap.get(pointersId)
                            self3.collection = pointersCollection
                            self3.id=pointersId
                            if(!pointersId)
                                return pointersId
                            self3.select = (key)=>{
                                return self2.select(key, self3)
                            }
                            self3.key = null
                            return self3
                            // return this.map.get(pointersCollection).get(pointersId) 
                            break;
                        case '*array':
                            let pointersIdArray = this.map.get(self3.key).get(self3.id)
                            // let pointersCollectionArray = pointersIdArray.map(key=> this.idToCollectionMap.get(key) )
                            res = pointersIdArray.map(pointersKey=>{
                                let pointersCollection = this.idToCollectionMap.get(pointersKey)
                                if(!pointersKey)
                                    return pointersKey     
                                return {
                                    ...self3,
                                    collection: pointersCollection,
                                    id: key,
                                    select: (key)=>{
                                        return self2.select(key, {
                                            ...self3,
                                            collection: pointersCollection,
                                            id: pointersKey
                                        })
                                    }
                                }
                            })
                            self3.key = null
                            return res
                            break;
                        case 'array':
                            res = this.map.get(self3.key).get(self3.id)
                            self3.key = null
                            return res
                            break;
                    }
                    // if(!this.keyToPropMap.has(self.key)) //that means key is a string
                    //     return this.map.get(self.key).get(self.id)
                        
                }

                return self3
            }
            return self2
        }
        
        self.create = (payload,key) =>{
            let newUUID
            if(!key)
                newUUID = this.newUUID()
            else newUUID = key
            let map
            this.idToCollectionMap.set(newUUID, self.collection)

            Object.keys(payload).forEach(payloadkey=>{//
                switch(this.keyToTypeMap.get(`${self.collection}To${payloadkey}`)){
                    case 'string':                        
                    case '*':
                        map = this.map.get(`${self.collection}To${payloadkey}`)
                        map.set(newUUID, payload[payloadkey])
                        break;
                    case 'array':
                    case '*array':
                        map = this.map.get(`${self.collection}To${payloadkey}`)
                        map.set(newUUID, [])
                        map = map.get(newUUID)
                        payload[payloadkey].forEach(data=>{
                            map.push(data)
                        })
                        break;
                    case 'object':
                        Object.keys(payload[payloadkey]).forEach(_=>{
                            map = this.map.get(`${self.collection}To${payloadkey}To${_}`)
                            map.set(newUUID, payload[payloadkey][_])
                        })
                        break;

                }
            })
            return newUUID
        }
        return self            
    }
    delete = (id) =>{
        let collection = this.idToCollectionMap.get(id)
        this.keyToPropMap.get(collection).forEach(prop=>{
            this.map.get(`${collection}To${prop}`).delete(id)
        })
        this.idToCollectionMap.delete(id)
    }
}
let db1 = new Realm('ah1')


db1.define('users',{
    ws: 'string',
    pool: '*' 
})
db1.define('pools',{
    master: '*',   
    users: '*array'
})
users = db1.collection('users')
pools = db1.collection('pools')
u1 = users.create({
    ws:'123',
    pool:null
})
u2 = users.create({
    ws:'34434',
    pool:null
})
p1 = pools.create({
    master: u1,
    users: [u1]
})
p = pools.id(p1)
p.users.add(u2)
console.log(p.users)
// console.log(p.users)
// console.log(db1)