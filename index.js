
const JsonToTS = require('json-to-ts') // создает интерфейсы
const request = require('request')     // работа с API swagger
const fs = require('fs')               // создание папок и файлов
const VM = require('./versionManager') // менеджер версий
const chalk = require('chalk')         // цветной терминал

/** новая строчка */
const NEW_LINE = "\n"
/** папка для интерфейсов */
const dirRecent = './interfaces'
/** папка для архива */
const dirArchive = './archive'
/** текущая версия архива */
const version = VM.getVersion()
/** флаг для бэкапа */
let bBackupFiles = false;

/** hash таблица, для примитивных типов **/
const hashTableTypes = {
  'string': 'a string',
  'integer': 1
}

/**
 * webUI: https://smartpromotionj2dacd8d8.ru1.hana.ondemand.com/smartpromotion/swagger-ui.html#
 * JSON:  https://smartpromotionj2dacd8d8.ru1.hana.ondemand.com/smartpromotion/v2/api-docs
 */
const requestOption = {
  method: 'GET',
  url: 'https://smartpromotionj2dacd8d8.ru1.hana.ondemand.com/smartpromotion/v2/api-docs',
  strictSSL: false,
  headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
  }
}

/** запрос к свагеру */
request(requestOption, (err, res) => {
  if (err) { return console.log(err) }
  let tmpData = JSON.parse(res.body)

  /** выборка интерфейсов JAVA из swagger */
  for (let DTO in tmpData.definitions) {
    /** таблица с комментариями */
    let hashTableComment = {}

    /** мутирующий JSON для инпута */
    let oJSONInterface = {}

    /** переменная, которая будет содержать интерфейс для каждого DTO */
    let sFinalInterface = "";

    /** очищение мусора из свагера */
    const regexpSwaggerClean = new RegExp(/«|»/g)
    /** имя файла и интерфейса без мусора */
    const sInterfaceFilename = `I${DTO}.interface.ts`.replace(regexpSwaggerClean, "")

    let obj = tmpData.definitions[DTO].properties;

    /** переменные в интерфейсе */
    for (let property in obj) {
      if (obj.hasOwnProperty(property)) {

        /** если не массив, резолвим до примитивного типа */
        oJSONInterface[property] = (obj[property].type === "array") ? obj[property] : hashTableTypes[obj[property].type]

        /** комментарии */
        hashTableComment[property] = obj[property].description;
      }
    }

    /** генерация интерфейса DTO из JSON */
    JsonToTS(oJSONInterface).forEach( typeInterface => {

      /** разделить по строчно */
      let tmpInterface = typeInterface.split(/\r?\n/)

      for (let property in oJSONInterface) {
        if (oJSONInterface.hasOwnProperty(property)) {        

          for (let i = 0; i < tmpInterface.length; i++) {

            /** меняет стандартное имя объекта на имя интерфейса */
            let regxRootObj = new RegExp("RootObject")
            /** поиск переменных */
            let myReg = new RegExp("  " + property);

            /** поиск и замена regxRootObj */
            if (tmpInterface[i].match(regxRootObj)) {
              /** понятное имя класса */
              tmpInterface[i] = tmpInterface[i].replace("RootObject", `I${DTO}`)
              /** выпиливает мусор */
              tmpInterface[i] = tmpInterface[i].replace(/«|»/g, "")
            }

            /** добавляет коментарий */
            if (tmpInterface[i].match(myReg)) {
              tmpInterface[i] = '  /**' + hashTableComment[property] + '*/' + NEW_LINE + tmpInterface[i]  
            }
          };
        }
      }

      /** соединение массива в большой string. каждый элемент новая строчка. */
      let tmpInterfaceTwo = tmpInterface.join("\r\n")

      // console.log(tmpInterfaceTwo)
      /** мутация интерфейса */
      sFinalInterface = (sFinalInterface === "") ? tmpInterfaceTwo : sFinalInterface += NEW_LINE + tmpInterfaceTwo
      // sFinalInterface = NEW_LINE + tmpInterfaceTwo


    })

    /** создание папки для интерфейсов */
    if (!fs.existsSync(dirRecent)){
        fs.mkdirSync(dirRecent);
    }

    let oldPath = `interfaces/${sInterfaceFilename}`
    let newPath = `${dirArchive}/${version}/${sInterfaceFilename}`


    // 1. check if file exists  -- done 
    // 2. copy old files -- done
    // 3. get new ones -- done

    try {
      if (fs.existsSync(`${dirRecent}/${sInterfaceFilename}`)) {
        // включает если не первый fetch
        bBackupFiles = true
        
        if (bBackupFiles) { 
          if (!fs.existsSync(dirArchive)){
            fs.mkdirSync(`${dirArchive}`);
          }
          if (!fs.existsSync(`${dirArchive}/${version}`)){
            fs.mkdirSync(`${dirArchive}/${version}`);
          }

          fs.copyFile(oldPath, newPath, (err) => {
            if (err) throw err;
            console.log(chalk.yellow(`интерфейс: ${sInterfaceFilename} был перемещен в архив ${dirArchive}/${version}`))
          });
        }
      }

    } catch(err) {
      console.error(err)
    }

    /** создает новый фаил с именем интерфейса */
    fs.writeFile(`${dirRecent}/${sInterfaceFilename}`, sFinalInterface, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log(chalk.green(`интерфейс: ${sInterfaceFilename} был создан в ${dirRecent}`));
    }); 
  }

  /** только если интерфейсов не существует */
  if (bBackupFiles) {
    VM.upVersion()
  }


  /** записывает json реквеста в папку с архивом */
  if(bBackupFiles) {
    fs.writeFile(`${dirArchive}/${version}/data.json`, JSON.stringify(JSON.parse(res.body), null, 2), function(err) {
      if(err) {
          return console.log(err);
      }
    }); 
  }

}); // ../request()
