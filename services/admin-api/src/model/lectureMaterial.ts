export interface Workbooks {
  id: number;
  pageId: Array<string>;
  workbookJapaneseName: string;
  workbookName: string;
}

export interface Uploaded {
  id: number;
}

export interface LectureMaterial {
  lectureId: string;
  userId: string;
  lectureUrl: string;
  userType: number; // enum 0, 1
  emailSent: number; // enum 0, 1
  workbooks: Array<Workbooks>;
  uploaded: Array<Uploaded>;
  standby: boolean;
  joined: boolean;
  info: object | null; // it will student info or null
}
