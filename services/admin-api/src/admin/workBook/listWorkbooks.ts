import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';

//# Method for fetching data from workbooks table
async function fetchWorkbooksInfo(enterpriseId: string) {
  let params = {};

  params = {
    TableName: 'workBook',
    KeyConditionExpression: 'enterpriseId = :enterpriseId',
    ExpressionAttributeValues: {
      ':enterpriseId': enterpriseId,
    },
  };
  try {
    const result = await dynamoDb.query(params);
    if (result && result.Items && result.Items.length > 0) {
      let workbooksArr = [];
      workbooksArr = result.Items;

      const workbooksDetailsArray = await Promise.all(workbooksArr.map(workbook => getWorkbookWithPageDetails(workbook)));

      return ({ status: true, workbooks: workbooksDetailsArray });
    } else {
      return ({ status: false, error: 'Item not found.' });
    }
  }
  catch (e) {
    return ({ status: false });
  }
}

async function getWorkbookWithPageDetails(workBook) {
  let params = {
    TableName: 'workBookPages',
    KeyConditionExpression: 'workbookId = :workbookId',
    ExpressionAttributeValues: {
      ':workbookId': workBook.workbookId
    }
  };

  const res = await dynamoDb.query(params);
  let pageIdArr: any = [];
  if (res && res.Items) {
    // return res.Items;
    let pageItems = res.Items;
    for (let page of pageItems) {
      let pagePath: string = workBook.enterpriseId + '/commonfiles/workbooks/' + workBook.workbookName + '/' + page.pageNo + '.' + page.extention;
      pageIdArr.push({ pagePath: pagePath, pageNo: page.pageNo });
    }
  }
  workBook.pageId = pageIdArr;
  return workBook;

}

export async function main(event: APIGatewayEvent, _: Context) {
  let statusCode = 0;
  if (event.pathParameters!.enterpriseId.toString() === 'null') {
    const err = new Error(`invalid pathParameters `);
    statusCode = 400;
    throw err;
  }
  try {
    const result: any = await fetchWorkbooksInfo(event.pathParameters!.enterpriseId);
    if (result.status) return success(result.workbooks); // Return the retrieved item
    else return failure({ status: false, error: 'Item not found.' }); // Return with error

  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
