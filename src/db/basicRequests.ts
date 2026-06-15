import { sql } from "../config/db.js";

export class BasicRequests {
  // RECUPERER UNE TABLE
  public async selectAllFromTable(table: string) {
    return await sql`SELECT * FROM ${sql(table)}`;
  }

  // RECUPERER PAR UN CHAMPS (egalité stricte)
  public async selectByFieldFromTable(
    table: string,
    fieldName: string,
    fieldValue: string
  ) {
    const result = await sql`SELECT * FROM ${sql(
      table
    )} WHERE ${fieldName} = ${fieldValue}`;
    return result[0];
  }

  //INSERER DANS UNE TABLE DES VALEURSET RETOURNER DES CHAMPS
  public async insertIntoTable(
    table: string,
    datas: object,
    fieldsToReturn: (keyof object)[]
  ) {
    // On transforme le tableau ['email', 'id'] en fragment sql "email, id"
    const returningFields = fieldsToReturn.map((field) => sql(field as string));

    const result = await sql`
      INSERT INTO ${sql(table)} ${sql(datas)}
      RETURNING ${sql(returningFields.join(", "))}
    `;
    return result[0];
  }
}

export const basicRequests = new BasicRequests();
