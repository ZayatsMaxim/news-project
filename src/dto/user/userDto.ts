export interface UserDto {
  id: number
  username: string
  firstName: string
  lastName: string
  /** Должность (company.title) */
  jobTitle?: string
  /** Отдел (company.department) */
  department?: string
}
