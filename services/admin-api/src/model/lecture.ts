import { LectureMaterial } from './lectureMaterial';
export interface Lecture {
  lectureId: string;
  enterpriseId: string;
  adminId: string;
  length: string;
  studentId: [string];
  lectureDate: string;
  lectureDetails: [LectureMaterial];
  startTime: string;
  endTime: string;
}
