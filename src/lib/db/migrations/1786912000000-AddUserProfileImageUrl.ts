import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileImageUrl1786912000000 implements MigrationInterface {
  name = "AddUserProfileImageUrl1786912000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "profile_image_url" text NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "profile_image_url"
    `);
  }
}
