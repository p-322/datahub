// Sawubona: ported from drizzle mysql-core (PlanetScale) to pg-core (Postgres on
// Discovery One). Column-for-column the same shape as upstream after its last
// migration (0004_object_item_change_primary_key), with these translations:
//   serial (BIGINT UNSIGNED)            -> bigserial
//   timestamp                           -> timestamptz
//   updated_at ON UPDATE CURRENT_TIMESTAMP -> database trigger (see the
//      migration); pg-core has no onUpdateNow()
//   no FK upstream (PlanetScale)        -> object_item.object_list_id references
//      object_list.id ON DELETE CASCADE
// The authoritative DDL is devops/terraform/servers/discovery-one/sql/
// sawubona_datahub_schema.sql; `drizzle-kit generate:pg` against this file
// must produce the same tables.
import {
  bigint,
  bigserial,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import {relations} from 'drizzle-orm';

export const objectLists = pgTable(
  'object_list',
  {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    name: varchar('name', {length: 256}).notNull(),
    description: text('description'),
    communityId: varchar('community_id', {length: 50}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    createdBy: varchar('created_by', {length: 256}).notNull(),
    // Kept current by the object_list_set_updated_at trigger in the database.
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  list => ({
    communityId: index('object_list_community_id').on(list.communityId),
  })
);

export const objectListsRelations = relations(objectLists, ({many}) => ({
  objects: many(objectItems),
}));

export const objectItems = pgTable(
  'object_item',
  {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    objectId: varchar('object_id', {length: 32}).notNull(),
    objectIri: text('object_iri').notNull(),
    objectListId: bigint('object_list_id', {mode: 'number'})
      .notNull()
      .references(() => objectLists.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    // James from Clerk about the length of the user ID: You should store it to 50, but currently,
    // they are 32 and shouldn't need to grow in length as they are a UUID based,
    // but you should increase it slightly just to be cautious.
    createdBy: varchar('created_by', {length: 50}).notNull(),
  },
  item => ({
    objectId: index('object_item_object_id').on(item.objectId),
    objectListId: index('object_item_object_list_id').on(item.objectListId),
    unique: unique('object_item_object_id_object_list_id_unique').on(
      item.objectId,
      item.objectListId
    ),
  })
);

export const objectItemsRelations = relations(objectItems, ({one}) => ({
  list: one(objectLists, {
    fields: [objectItems.objectListId],
    references: [objectLists.id],
  }),
}));
