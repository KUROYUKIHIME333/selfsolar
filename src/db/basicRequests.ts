import { sql } from "../config/db.js";
import type { TablesFieldsPossibilities } from "../types/dbTypes.js";

export class BasicRequests {
  // RECUPERER UNE TABLE
  public async selectAllFromTable(table: string) {
    const result = await sql`SELECT * FROM ${sql(table)}`;
    return result;
  }

  // RECUPERER PAR UN CHAMPS (egalité stricte)
  public async selectByFieldFromTable(
    table: string,
    fieldName: string,
    fieldValue: TablesFieldsPossibilities
  ) {
    const result = await sql`SELECT * FROM ${sql(
      table
    )} WHERE ${fieldName} = ${fieldValue}`;
    return result[0];
  }

  //INSERER DANS UNE TABLE DES VALEURS ET RETOURNER DES CHAMPS
  public async insertValuesIntoTable(
    table: string,
    datas: object,
    fieldsToReturn: string[] = ["*"]
  ) {
    // Transformer le tableau en fragment sql
    const returningFields = fieldsToReturn.map((field) => sql(field as string));

    const result = await sql`
      INSERT INTO ${sql(table)} ${sql(datas)}
      RETURNING ${sql(returningFields.join(", "))}
    `;
    return result[0];
  }

  public async softDeleteFromTable(
    table: string,
    id: string,
    fieldsToReturn: string[] = ["*"]
  ) {
    const returningFields = fieldsToReturn.map((field) => sql(field as string));
    return await sql`UPDATE ${sql(table)} 
      SET isDeleted = true
      WHERE id = ${id}
      RETURNING ${sql(returningFields.join(", "))}`;
  }

  public async hardDeleteFromTable(table: string, id: string) {
    return await sql`DELETE FROM ${sql(table)} WHERE id = ${id}`;
  }

  public async countAllFromTable(
    table: string,
    criteria: "all" | "active" | "deleted" = "active"
  ) {
    let result = await sql`SELECT COUNT(*) FROM ${sql(
      table
    )} WHERE isDeleted = false`;

    if (criteria === "all") {
      result = await sql`SELECT COUNT(*) FROM ${sql(table)}`;
    }
    if (criteria === "deleted") {
      result = await sql`SELECT COUNT(*) FROM ${sql(
        table
      )} WHERE isDeleted = true`;
    }

    return result[0]?.count;
  }

  public async countByAFieldFromTable(
    table: string,
    fieldName: string,
    fieldValue: TablesFieldsPossibilities,
    criteria: "all" | "active" | "deleted" = "active"
  ) {
    let result = await sql`SELECT COUNT(*) FROM ${sql(
      table
    )} WHERE isDeleted = false AND WHERE ${fieldName} = ${fieldValue}`;

    if (criteria === "all") {
      result = await sql`SELECT COUNT(*) FROM ${sql(
        table
      )} WHERE ${fieldName} = ${fieldValue}`;
    }
    if (criteria === "deleted") {
      result = await sql`SELECT COUNT(*) FROM ${sql(
        table
      )} WHERE isDeleted = true WHERE ${fieldName} = ${fieldValue}`;
    }

    return result[0]?.count;
  }
}

export const basicRequests = new BasicRequests();
