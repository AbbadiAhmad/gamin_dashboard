<template>
  <form @submit.prevent="submitForm">
    <div class="form-control" :class="{invalid: !name.isValid}">
      <label for="name">Game Name</label>
      <input
        type="text"
        id="name"
        v-model.trim="name.val"
        @blur="clearValidity('name')"
      />
      <p v-if="!name.isValid">Name must not be empty.</p>
    </div>

    <div class="form-control" :class="{invalid: !description.isValid}">
      <label for="description">Description</label>
      <textarea
        id="description"
        rows="3"
        v-model.trim="description.val"
        @blur="clearValidity('description')"
      ></textarea>
    </div>

    <div class="form-row">
      <div class="form-control" :class="{invalid: !minimumPoint.isValid}">
        <label for="minimumPoint">Minimum Point</label>
        <input
          type="number"
          id="minimumPoint"
          v-model.number="minimumPoint.val"
          @blur="clearValidity('minimumPoint')"
        />
        <p v-if="!minimumPoint.isValid">Minimum point is required.</p>
      </div>

      <div class="form-control" :class="{invalid: !maximumPoint.isValid}">
        <label for="maximumPoint">Maximum Point</label>
        <input
          type="number"
          id="maximumPoint"
          v-model.number="maximumPoint.val"
          @blur="clearValidity('maximumPoint')"
        />
        <p v-if="!maximumPoint.isValid">Maximum point is required.</p>
      </div>
    </div>

    <div class="form-control" :class="{invalid: !gamingGroupId.isValid}">
      <label for="gamingGroupId">Gaming Group</label>
      <select
        id="gamingGroupId"
        v-model.number="gamingGroupId.val"
        @blur="clearValidity('gamingGroupId')"
      >
        <option value="">Select a gaming group</option>
        <option v-for="group in gamingGroups" :key="group.id" :value="group.id">
          {{ group.name }}
        </option>
      </select>
      <p v-if="!gamingGroupId.isValid">Please select a gaming group.</p>
    </div>

    <div class="form-control">
      <label for="status">Status</label>
      <select id="status" v-model="status.val">
        <option value="coming">Coming</option>
        <option value="running">Running</option>
        <option value="past">Past</option>
      </select>
    </div>

    <div class="form-control">
      <label for="gameType">Game Type</label>
      <select id="gameType" v-model="gameType.val" :disabled="isEdit">
        <option value="points">Points-Based (Manual Scoring)</option>
        <option value="time">Time-Based (Reaction Game)</option>
      </select>
      <p v-if="isEdit" class="info-text">Game type cannot be changed after creation</p>
    </div>

    <!-- Time-based game options -->
    <div v-if="gameType.val === 'time'" class="time-options">
      <div class="form-row">
        <div class="form-control">
          <label for="timingMode">Timing Mode</label>
          <select id="timingMode" v-model="timingMode.val">
            <option value="server">Server-Trusted (requires stable connection)</option>
            <option value="client">Client-Trusted (works with poor connection)</option>
          </select>
        </div>

        <div class="form-control">
          <label for="countdownSeconds">Countdown (seconds)</label>
          <select id="countdownSeconds" v-model.number="countdownSeconds.val">
            <option :value="3">3 seconds</option>
            <option :value="5">5 seconds</option>
            <option :value="10">10 seconds</option>
          </select>
        </div>
      </div>

      <div class="time-info">
        <p><strong>Note:</strong> For time-based games:</p>
        <ul>
          <li>Maximum Point = Max time in tenths of seconds (e.g., 100 = 10.0 seconds)</li>
          <li>Score = Max Points - (reaction time in tenths)</li>
          <li>Example: Max 100, reaction 2.3s → Score = 100 - 23 = 77</li>
        </ul>
      </div>
    </div>

    <div class="form-control">
      <label>
        <input type="checkbox" v-model="showInDashboard.val" />
        Show in Dashboard
      </label>
    </div>

    <h3 v-if="gameType.val !== 'time'">Scoring Configuration</h3>
    <div class="scoring-section" v-if="gameType.val !== 'time'">
      <div v-for="(score, index) in scoring" :key="index" class="scoring-item">
        <div class="form-row">
          <div class="form-control">
            <label>Place Name</label>
            <input type="text" v-model.trim="score.placeName" />
          </div>
          <div class="form-control">
            <label>Place</label>
            <input type="number" v-model.number="score.place" />
          </div>
          <div class="form-control">
            <label>Score</label>
            <input type="number" v-model.number="score.score" />
          </div>
          <div class="form-control">
            <button type="button" @click="removeScoring(index)" class="btn-remove" v-if="scoring.length > 1">Remove</button>
          </div>
        </div>
      </div>
      <base-button type="button" mode="outline" @click="addScoring">Add Scoring Entry</base-button>
    </div>

    <p v-if="!formIsValid">Please fix the above errors and submit again.</p>
    <div class="actions">
      <base-button>{{ isEdit ? 'Update' : 'Create' }} Game</base-button>
      <base-button type="button" mode="flat" @click="goBack">Cancel</base-button>
    </div>
  </form>
</template>

<script>
export default {
  props: {
    isEdit: {
      type: Boolean,
      default: false
    },
    gameData: {
      type: Object,
      default: null
    },
    gamingGroups: {
      type: Array,
      required: true
    }
  },
  emits: ['save-data'],
  data() {
    return {
      name: {
        val: this.gameData?.name || '',
        isValid: true,
      },
      description: {
        val: this.gameData?.description || '',
        isValid: true,
      },
      minimumPoint: {
        val: this.gameData?.minimumPoint ?? 0,
        isValid: true,
      },
      maximumPoint: {
        val: this.gameData?.maximumPoint ?? 100,
        isValid: true,
      },
      gamingGroupId: {
        val: this.gameData?.gamingGroupId || '',
        isValid: true,
      },
      status: {
        val: this.gameData?.status || 'coming',
      },
      gameType: {
        val: this.gameData?.gameType || 'points',
      },
      timingMode: {
        val: this.gameData?.timingMode || 'server',
      },
      countdownSeconds: {
        val: this.gameData?.countdownSeconds || 5,
      },
      showInDashboard: {
        val: this.gameData?.showInDashboard !== false,
      },
      scoring: this.gameData?.scoring?.length > 0 ? [...this.gameData.scoring] : [
        { placeName: '1st', place: 1, score: 5 },
        { placeName: 'other', place: -1, score: 0 }
      ],
      formIsValid: true,
    };
  },
  methods: {
    clearValidity(input) {
      this[input].isValid = true;
    },
    validateForm() {
      this.formIsValid = true;

      if (this.name.val === '') {
        this.name.isValid = false;
        this.formIsValid = false;
      }

      if (!this.gamingGroupId.val) {
        this.gamingGroupId.isValid = false;
        this.formIsValid = false;
      }

      if (this.minimumPoint.val === '' || this.minimumPoint.val === null) {
        this.minimumPoint.isValid = false;
        this.formIsValid = false;
      }

      if (this.maximumPoint.val === '' || this.maximumPoint.val === null) {
        this.maximumPoint.isValid = false;
        this.formIsValid = false;
      }
    },
    addScoring() {
      this.scoring.push({ placeName: '', place: 0, score: 0 });
    },
    removeScoring(index) {
      this.scoring.splice(index, 1);
    },
    submitForm() {
      this.validateForm();

      if (!this.formIsValid) {
        return;
      }

      const formData = {
        name: this.name.val,
        description: this.description.val,
        minimumPoint: this.minimumPoint.val,
        maximumPoint: this.maximumPoint.val,
        gamingGroupId: this.gamingGroupId.val,
        status: this.status.val,
        gameType: this.gameType.val,
        timingMode: this.timingMode.val,
        countdownSeconds: this.countdownSeconds.val,
        showInDashboard: this.showInDashboard.val,
        scoring: this.gameType.val !== 'time' ? this.scoring : []
      };

      this.$emit('save-data', formData);
    },
    goBack() {
      const groupId = this.gamingGroupId.val;
      if (groupId) {
        this.$router.push(`/gaming-groups/${groupId}`);
      } else {
        this.$router.push('/gaming-groups');
      }
    }
  },
};
</script>

<style scoped>
.form-control {
  margin: 0.5rem 0;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-control {
  flex: 1;
}

label {
  font-weight: bold;
  display: block;
  margin-bottom: 0.5rem;
}

input,
textarea,
select {
  display: block;
  width: 100%;
  border: 1px solid #ccc;
  font: inherit;
  padding: 0.25rem;
}

input:focus,
textarea:focus,
select:focus {
  background-color: #f0e6fd;
  outline: none;
  border-color: #3d008d;
}

.invalid label {
  color: red;
}

.invalid input,
.invalid textarea,
.invalid select {
  border: 1px solid red;
}

.info-text {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
  font-style: italic;
}

select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.scoring-section {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.scoring-item {
  background: white;
  padding: 0.5rem;
  margin: 0.5rem 0;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.btn-remove {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1.8rem;
}

.btn-remove:hover {
  background: #c82333;
}

h3 {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.time-options {
  background: #e3f2fd;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.time-info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: white;
  border-radius: 4px;
  font-size: 0.9rem;
}

.time-info p {
  margin: 0 0 0.5rem 0;
}

.time-info ul {
  margin: 0;
  padding-left: 1.5rem;
}

.time-info li {
  margin-bottom: 0.25rem;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  input,
  textarea,
  select {
    padding: 0.5rem;
    font-size: 1rem;
  }

  .scoring-section {
    padding: 0.75rem;
  }

  .scoring-item {
    padding: 0.75rem;
  }

  .btn-remove {
    width: 100%;
    margin-top: 0.5rem;
  }

  .actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .actions button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  label {
    font-size: 0.95rem;
  }

  input,
  textarea,
  select {
    padding: 0.75rem;
    font-size: 1rem;
  }

  h3 {
    font-size: 1.1rem;
  }
}
</style>
