export interface WorkBooks {
  id: number;
}
export interface Uploaded {
  id: number;
}
export interface Participant {
  lectureId: string;
  userId: string;
  userType: number;
  emailSent: number;
  workBooks: Array<WorkBooks>;
  uploaded: Array<Uploaded>;
  standby: boolean;
  lastLoginDate: string;
  joined: boolean;
  updatedDate: string;
  createdDate: string;
  deletedDate: string;
}
