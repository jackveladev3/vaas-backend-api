import dynamoDb from './dynamodb-lib.js';

export default {
  getTutor: async (tutorId) => {
    const params = {
      TableName: 'tutors',
      KeyConditionExpression: 'tutorId = :tutorId',
      ExpressionAttributeValues: {
        ':tutorId': tutorId,
      },
    };
    const result = await dynamoDb.query(params);
    return result;
  },
  getTutors: async (tutor, tutorIdList, i) => {
    // keyListの作成
    let keyList = [];
    for (
      let j = i * 100;
      j >= i * 100 && j < (i + 1) * 100 && j < tutorIdList.length;
      j++
    ) {
      keyList.push({
        tutorId: tutorIdList[j],
      });
    }
    if (!keyList.length) return tutor;
    let params = {
      RequestItems: {},
    };
    let tutorTable = 'smartclass-dev-tutors';
    params.RequestItems[tutorTable] = {
      Keys: keyList,
    };
    let data = await dynamoDb.batchGet(params);
    for (let i in data.Responses[tutorTable]) {
      tutor[data.Responses[tutorTable][i].tutorId] =
        data.Responses[tutorTable][i];
    }
    if (i < Math.floor(tutorIdList.length / 100)) {
      return await this.getTutors(tutor, tutorIdList, i + 1);
    } else {
      return tutor;
    }
  },
  getStudents: async (student, studentIdList, i) => {
    // keyListの作成
    let keyList = [];
    for (
      let j = i * 100;
      j >= i * 100 && j < (i + 1) * 100 && j < studentIdList.length;
      j++
    ) {
      keyList.push({
        studentId: studentIdList[j],
      });
    }
    if (!keyList.length) return student;
    let params = {
      RequestItems: {},
    };
    let studentTable = 'smartclass-dev-students';
    params.RequestItems[studentTable] = {
      Keys: keyList,
    };
    let data = await dynamoDb.batchGet(params);
    for (let i in data.Responses[studentTable]) {
      student[data.Responses[studentTable][i].studentId] =
        data.Responses[studentTable][i];
    }
    if (i < Math.floor(studentIdList.length / 100)) {
      return await this.getStudents(student, studentIdList, i + 1);
    } else {
      return student;
    }
  },
  getParticipants: async (participant, participantIdList, i) => {
    // keyListの作成
    let keyList = [];
    for (
      let j = i * 100;
      j >= i * 100 && j < (i + 1) * 100 && j < participantIdList.length;
      j++
    ) {
      keyList.push({
        lectureId: participantIdList[j],
      });
    }
    if (!keyList.length) return participant;
    let params = {
      RequestItems: {},
    };
    let participantTable = 'smartclass-dev-participants';
    params.RequestItems[participantTable] = {
      Keys: keyList,
    };
    let data = await dynamoDb.batchGet(params);
    for (let i in data.Responses[participantTable]) {
      participant[data.Responses[participantTable][i].participantId] =
        data.Responses[participantTable][i];
    }
    if (i < Math.floor(participantIdList.length / 100)) {
      return await this.getParticipants(participant, participantIdList, i + 1);
    } else {
      return participant;
    }
  },
  getUniqueId: async () => {
    let uniqueId =
      Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    return uniqueId;
  },
};
