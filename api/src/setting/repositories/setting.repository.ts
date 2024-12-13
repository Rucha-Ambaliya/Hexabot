/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { Injectable } from '@nestjs/common';
import {
  EventEmitter2,
  IHookSettingsGroupLabelOperationMap,
} from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import {
  Document,
  FilterQuery,
  Model,
  Query,
  Types,
  UpdateQuery,
  UpdateWithAggregationPipeline,
} from 'mongoose';

import { I18nService } from '@/i18n/services/i18n.service';
import { BaseRepository, EHook } from '@/utils/generics/base-repository';
import { TFilterQuery } from '@/utils/types/filter.types';

import { Setting } from '../schemas/setting.schema';
import { SettingType } from '../schemas/types';

@Injectable()
export class SettingRepository extends BaseRepository<Setting> {
  constructor(
    readonly eventEmitter: EventEmitter2,
    @InjectModel(Setting.name) readonly model: Model<Setting>,
    private readonly i18n: I18nService,
  ) {
    super(eventEmitter, model, Setting);
  }

  async preCreateValidate(
    doc: Document<unknown, unknown, Setting> &
      Setting & { _id: Types.ObjectId },
    filterCriteria: FilterQuery<Setting>,
    updates: UpdateWithAggregationPipeline | UpdateQuery<Setting>,
  ) {
    this.validateSettingValue(doc.type, doc.value);
    if (filterCriteria && updates) {
      this.eventEmitter.emit(
        `hook:setting:${EHook.preUpdateValidate}`,
        filterCriteria,
        updates,
      );
    }
  }

  async preUpdateValidate(
    criteria: string | TFilterQuery<Setting>,
    dto: UpdateQuery<Setting>,
    filterCriteria: FilterQuery<Setting>,
    updates: UpdateWithAggregationPipeline | UpdateQuery<Setting>,
  ): Promise<void> {
    const payload = dto.$set ? dto.$set : dto;
    if (typeof payload.value !== 'undefined') {
      const { type } =
        'type' in payload ? payload : await this.findOne(criteria);
      this.validateSettingValue(type, payload.value);
      this.eventEmitter.emit(
        `hook:setting:${EHook.preUpdateValidate}`,
        filterCriteria,
        updates,
      );
    }
  }

  /**
   * Emits an event after a `Setting` has been updated.
   *
   * This method is used to synchronize global settings by emitting an event
   * based on the `group` and `label` of the `Setting`.
   *
   * @param _query The Mongoose query object used to find and update the document.
   * @param setting The updated `Setting` object.
   */
  async postUpdate(
    _query: Query<
      Document<Setting, any, any>,
      Document<Setting, any, any>,
      unknown,
      Setting,
      'findOneAndUpdate'
    >,
    setting: Setting,
  ) {
    const group = setting.group as keyof IHookSettingsGroupLabelOperationMap;
    const label = setting.label as '*';

    // Sync global settings var
    this.eventEmitter.emit(`hook:${group}:${label}`, setting);
  }

  /**
   * Validates the `Setting` document after it has been retrieved.
   *
   * Checks the `type` of the setting and validates the `value` field according to the type:
   * - `text` expects a string.
   * - `multiple_text` expects an array of strings.
   * - `checkbox` expects a boolean.
   *
   * @param setting The `Setting` document to be validated.
   */
  private validateSettingValue(type: SettingType, value: any) {
    if (
      (type === SettingType.text || type === SettingType.textarea) &&
      typeof value !== 'string' &&
      value !== null
    ) {
      throw new Error('Setting Model : Value must be a string!');
    } else if (type === SettingType.multiple_text) {
      const isStringArray =
        Array.isArray(value) &&
        value.every((v) => {
          return typeof v === 'string';
        });
      if (!isStringArray) {
        throw new Error('Setting Model : Value must be a string array!');
      }
    } else if (
      type === SettingType.checkbox &&
      typeof value !== 'boolean' &&
      value !== null
    ) {
      throw new Error('Setting Model : Value must be a boolean!');
    } else if (
      type === SettingType.number &&
      typeof value !== 'number' &&
      value !== null
    ) {
      throw new Error('Setting Model : Value must be a number!');
    }
  }
}
