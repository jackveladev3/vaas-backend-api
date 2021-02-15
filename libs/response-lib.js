export function success(body) {
  return buildResponse(200, body);
}

export function failure(body) {
  return buildResponse(500, body);
}

export function error(statusCode = 500, body) {
  let message = '';

  switch (statusCode) {
    case 400:
      message = 'Bad Request.';
      break;
    case 405:
      message = 'Already existed.';
      break;
    case 500:
      message = 'Internal server error.';
      break;
  }

  body = JSON.stringify({message});
  return buildResponse(statusCode, body);
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
}
