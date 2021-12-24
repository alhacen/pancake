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
    collection = (collection) =>{
        let self ={}
        self.collection = collection
        
        self.create = (payload) =>{
            let newUUID = this.newUUID()
            let map
            this.idToCollectionMap.set(newUUID, self.collection)

            Object.keys(payload).forEach(payloadkey=>{
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
        
        self.id = (id) =>{
            let self2 = {}
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

        return self            
    }
    Reference = (id) =>{
        return {
            auth: this.pointerAuth,
            id: id
        }
    }
}
let db1 = new Realm('ah1')

db1.define('pool',{
    users: '*array'
})
db1.define('ll',{
    data: 'string',
})


let ll = db1.collection('ll')
l1 = ll.create({
    data: 1,
})
l2 = ll.create({
    data: 2,
})
l3 = ll.create({
    data:3,
})
l4 = ll.create({
    data:4,
})
let pool = db1.collection('pool')
let p1 = pool.create({
    users:[l1, l2, l3, l4]    
})
let data = pool.id(p1).select('users')
data.forEach(_=>{
    console.log(_.select('data'))
})  