import AWS from "./aws-sdk";
import config from "../config";

const client = new AWS.DynamoDB.DocumentClient();

function updateTableName(params) {
  return {
    ...params,
    TableName: `${process.env.databaseServiceName}-${config.resourcesStage}-${params.TableName}`,
  };
}

export default {
  get: (params) => client.get(updateTableName(params)).promise(),
  scan: async (params) => {
    let resultArr = [];
    await client.scan(updateTableName(params), onScan).promise();
    return resultArr;

    function onScan(err, data) {
      if (err) {
        console.error(
          "Unable to scan the table. Error JSON:",
          JSON.stringify(err, null, 2)
        );
      } else {
        data.Items.forEach(function (itemdata) {
          resultArr.push(itemdata);
        });
        // continue scanning if we have more items
        if (typeof data.LastEvaluatedKey != "undefined") {
          params.ExclusiveStartKey = data.LastEvaluatedKey;
          client.scan(params, onScan);
        }
      }
    }
  },
  batchGet: (params) => client.batchGet(params).promise(),
  batchWrite: (params) => client.batchWrite(params).promise(),
  query: (params) => client.query(updateTableName(params)).promise(),
  put: (params) => client.put(updateTableName(params)).promise(),
  update: (params) => client.update(updateTableName(params)).promise(),
  delete: (params) => client.delete(updateTableName(params)).promise(),
  transactWriteItems: (params) => client.transactWrite(params).promise()
};
