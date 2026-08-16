import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateActivities1786908000000 implements MigrationInterface {
  name = "CreateActivities1786908000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "strava_activity_id" bigint NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "activity_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "distance" double precision NOT NULL,
        "moving_time" integer NOT NULL,
        "workout_type" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_activities_strava_activity_id" UNIQUE ("strava_activity_id"),
        CONSTRAINT "FK_activities_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activities_user_id_activity_date"
      ON "activities" ("user_id", "activity_date" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_activities_user_id_activity_date"`,
    );
    await queryRunner.query(`DROP TABLE "activities"`);
  }
}
