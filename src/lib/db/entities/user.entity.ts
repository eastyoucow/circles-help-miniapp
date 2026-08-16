import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Activity } from "./activity.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "bigint", unique: true, name: "telegram_user_id" })
  telegramUserId!: string;

  @Column({ type: "bigint", unique: true, name: "strava_athlete_id" })
  stravaAthleteId!: string;

  @Column({ type: "varchar", length: 100, name: "first_name" })
  firstName!: string;

  @Column({
    type: "varchar",
    length: 100,
    name: "last_name",
    default: "",
  })
  lastName!: string;

  @Column({ type: "text", name: "strava_access_token_encrypted" })
  stravaAccessTokenEncrypted!: string;

  @Column({ type: "text", name: "strava_refresh_token_encrypted" })
  stravaRefreshTokenEncrypted!: string;

  @Column({ type: "timestamptz", name: "strava_token_expires_at" })
  stravaTokenExpiresAt!: Date;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => Activity, (activity) => activity.user)
  activities!: Activity[];
}
