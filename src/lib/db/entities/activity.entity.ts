import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity({ name: "activities" })
@Index("IDX_activities_user_id_activity_date", ["userId", "activityDate"])
export class Activity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.activities, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "bigint", unique: true, name: "strava_activity_id" })
  stravaActivityId!: string;

  /** Strava `name`. */
  @Column({ type: "varchar", length: 255, name: "title" })
  title!: string;

  /** Strava `description`. */
  @Column({ type: "text", name: "description", default: "" })
  description!: string;

  /** Strava `start_date`. */
  @Column({ type: "timestamptz", name: "activity_date" })
  activityDate!: Date;

  /** Strava `distance`, meters. */
  @Column({ type: "double precision", name: "distance" })
  distance!: number;

  /** Strava `moving_time`, seconds. */
  @Column({ type: "integer", name: "moving_time" })
  movingTime!: number;

  /** Strava `workout_type`. Null when Strava omits it. */
  @Column({ type: "integer", name: "workout_type", nullable: true })
  workoutType!: number | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
